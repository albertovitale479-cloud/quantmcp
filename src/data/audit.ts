import type { DatasetSource, MarketDataset, OHLCVBar } from './types'

export type DataAuditClassification = 'exact-duplicate' | 'near-duplicate' | 'expected-high-correlation' | 'distinct'
export interface AssetAudit { datasetId: string; symbol: string; source: string; barCount: number; start?: number; end?: number; first10: OHLCVBar[]; last10: OHLCVBar[]; canonicalHash: string; mappingError?: string }
export interface PairAudit { symbols: [string, string]; returnCorrelation: number; exactDuplicateRowPercent: number; sameSourceFile: boolean; sameBarsReference: boolean; classification: DataAuditClassification }
export interface DatasetAuditReport { generatedAt: string; assets: AssetAudit[]; pairs: PairAudit[]; releaseBlockers: string[] }

/** Small deterministic browser-safe FNV-1a fingerprint for the canonical normalized OHLCV values. */
function fingerprint(bars: OHLCVBar[]) {
  let hash = 0x811c9dc5
  for (const bar of bars) for (const char of `${bar.timestamp}|${bar.open}|${bar.high}|${bar.low}|${bar.close}|${bar.volume ?? ''};`) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 0x01000193) }
  return (hash >>> 0).toString(16).padStart(8, '0')
}
function correlation(left: OHLCVBar[], right: OHLCVBar[]) {
  const rightCloses = new Map(right.map((bar) => [bar.timestamp, bar.close])); const pairs: Array<[number, number]> = []
  for (let index = 1; index < left.length; index += 1) { const rightNow = rightCloses.get(left[index].timestamp); const rightPrior = rightCloses.get(left[index - 1].timestamp); if (rightNow && rightPrior) pairs.push([left[index].close / left[index - 1].close - 1, rightNow / rightPrior - 1]) }
  if (pairs.length < 2) return Number.NaN
  const leftMean = pairs.reduce((sum, pair) => sum + pair[0], 0) / pairs.length; const rightMean = pairs.reduce((sum, pair) => sum + pair[1], 0) / pairs.length
  const covariance = pairs.reduce((sum, pair) => sum + (pair[0] - leftMean) * (pair[1] - rightMean), 0); const leftVariance = pairs.reduce((sum, pair) => sum + (pair[0] - leftMean) ** 2, 0); const rightVariance = pairs.reduce((sum, pair) => sum + (pair[1] - rightMean) ** 2, 0)
  return leftVariance && rightVariance ? covariance / Math.sqrt(leftVariance * rightVariance) : Number.NaN
}
function exactRows(left: OHLCVBar[], right: OHLCVBar[]) {
  const rightRows = new Set(right.map((bar) => `${bar.timestamp}|${bar.open}|${bar.high}|${bar.low}|${bar.close}|${bar.volume ?? ''}`)); let matches = 0
  for (const bar of left) if (rightRows.has(`${bar.timestamp}|${bar.open}|${bar.high}|${bar.low}|${bar.close}|${bar.volume ?? ''}`)) matches += 1
  return matches / Math.max(1, Math.min(left.length, right.length)) * 100
}

/** Audits source mapping, normalized data identity and return similarity. High correlation alone is reported, never treated as a defect. */
export function auditDatasets(datasets: MarketDataset[], sources: DatasetSource[]): DatasetAuditReport {
  const expected = new Map(sources.map((source) => [source.id, source])); const assets = datasets.map((dataset) => {
    const source = expected.get(dataset.id); const errors = [!source ? `Unknown dataset ID ${dataset.id}` : undefined, source && source.symbol !== dataset.asset.symbol ? `Symbol mapping expected ${source.symbol}, received ${dataset.asset.symbol}` : undefined, source && source.filename !== dataset.asset.source ? `File mapping expected ${source.filename}, received ${dataset.asset.source}` : undefined].filter(Boolean)
    return { datasetId: dataset.id, symbol: dataset.asset.symbol, source: dataset.asset.source, barCount: dataset.bars.length, start: dataset.bars[0]?.timestamp, end: dataset.bars.at(-1)?.timestamp, first10: dataset.bars.slice(0, 10), last10: dataset.bars.slice(-10), canonicalHash: fingerprint(dataset.bars), ...(errors.length ? { mappingError: errors.join('; ') } : {}) }
  })
  const pairs: PairAudit[] = []
  for (let left = 0; left < datasets.length; left += 1) for (let right = left + 1; right < datasets.length; right += 1) {
    const a = datasets[left]; const b = datasets[right]; const duplicate = exactRows(a.bars, b.bars); const correlated = correlation(a.bars, b.bars); const sameSourceFile = a.asset.source === b.asset.source; const sameBarsReference = a.bars === b.bars
    const classification: DataAuditClassification = sameSourceFile || sameBarsReference || duplicate === 100 ? 'exact-duplicate' : duplicate > 95 ? 'near-duplicate' : Math.abs(correlated) >= .9 ? 'expected-high-correlation' : 'distinct'
    pairs.push({ symbols: [a.asset.symbol, b.asset.symbol], returnCorrelation: correlated, exactDuplicateRowPercent: duplicate, sameSourceFile, sameBarsReference, classification })
  }
  const releaseBlockers = [...assets.filter((asset) => asset.mappingError).map((asset) => `${asset.symbol}: ${asset.mappingError}`), ...pairs.filter((pair) => pair.classification === 'exact-duplicate').map((pair) => `${pair.symbols.join(' / ')} resolve to identical canonical market data`)]
  return { generatedAt: new Date().toISOString(), assets, pairs, releaseBlockers }
}
