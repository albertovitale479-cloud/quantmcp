import { normalizeOhlcv } from './normalizer'
import { createValidationReport, validateBar } from './validator'
import type { DatasetValidationReport, OHLCVBar } from './types'
export interface ParsedMarketData { bars: OHLCVBar[]; validation: DatasetValidationReport }
/** Parses the inspected semicolon-delimited continuous-futures format: datetime;open;high;low;close;volume. */
export function parseContinuousFutures(text: string): ParsedMarketData {
  const validation = createValidationReport(); const bars: OHLCVBar[] = []; const seen = new Set<number>(); let prior: number | undefined; const intervals = new Map<number, number>()
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    validation.totalRows += 1; const cells = line.split(';').map((cell) => cell.trim())
    if (cells.length !== 6) { validation.malformedRows += 1; validation.rejectedRows += 1; continue }
    if (cells.some((cell) => !cell)) { validation.missingValues += 1; validation.rejectedRows += 1; continue }
    const bar = normalizeOhlcv({ timestamp: cells[0], open: cells[1], high: cells[2], low: cells[3], close: cells[4], volume: cells[5] })
    if (!bar) { validation.malformedRows += 1; validation.rejectedRows += 1; continue }
    const result = validateBar(bar)
    if (result !== 'valid') { validation[result === 'invalid-volume' ? 'invalidVolume' : 'invalidOhlc'] += 1; validation.rejectedRows += 1; continue }
    if (seen.has(bar.timestamp)) { validation.duplicates += 1; validation.rejectedRows += 1; continue }
    if (prior !== undefined && bar.timestamp < prior) { validation.outOfOrderRows += 1; validation.rejectedRows += 1; continue }
    if (prior !== undefined) { const interval = bar.timestamp - prior; intervals.set(interval, (intervals.get(interval) ?? 0) + 1) }
    seen.add(bar.timestamp); prior = bar.timestamp; bars.push(bar); validation.validRows += 1
  }
  const inferred = [...intervals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]; validation.inferredInterval = inferred
  validation.irregularIntervals = inferred === undefined ? 0 : [...intervals.entries()].filter(([interval]) => interval !== inferred).reduce((total, [, count]) => total + count, 0)
  if (validation.rejectedRows) validation.warnings.push(`${validation.rejectedRows} malformed, duplicate, out-of-order, or invalid rows were rejected.`)
  if (validation.irregularIntervals) validation.warnings.push(`${validation.irregularIntervals} non-modal time gaps were retained as observed market/session gaps.`)
  return { bars, validation }
}
