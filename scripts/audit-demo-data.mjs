import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const sources = [['6B', '6b-demo-1m.txt'], ['6C', '6c-demo-1m.txt'], ['6E', '6e-demo-1m.txt'], ['ES', 'es-demo-1m.txt'], ['GC', 'gc-demo-1m.txt'], ['NQ', 'nq-demo-1m.txt'], ['YM', 'ym-demo-1m.txt'], ['ZC', 'zc-demo-1m.txt']]
const parse = (filename) => readFileSync(`public/data/${filename}`, 'utf8').trim().split(/\r?\n/).map((line) => { const [timestamp, open, high, low, close, volume] = line.split(';'); return { timestamp, open: Number(open), high: Number(high), low: Number(low), close: Number(close), volume: Number(volume) } })
const correlation = (left, right) => {
  const other = new Map(right.map((bar) => [bar.timestamp, bar.close])); const pairs = []
  for (let i = 1; i < left.length; i += 1) { const now = other.get(left[i].timestamp); const prior = other.get(left[i - 1].timestamp); if (now && prior) pairs.push([left[i].close / left[i - 1].close - 1, now / prior - 1]) }
  const means = pairs.reduce((sum, item) => [sum[0] + item[0] / pairs.length, sum[1] + item[1] / pairs.length], [0, 0]); const covariance = pairs.reduce((sum, item) => sum + (item[0] - means[0]) * (item[1] - means[1]), 0); const lx = pairs.reduce((sum, item) => sum + (item[0] - means[0]) ** 2, 0); const ly = pairs.reduce((sum, item) => sum + (item[1] - means[1]) ** 2, 0)
  return covariance / Math.sqrt(lx * ly)
}
const datasets = sources.map(([symbol, filename]) => ({ symbol, filename, bars: parse(filename), sha256: createHash('sha256').update(readFileSync(`public/data/${filename}`)).digest('hex') }))
const pairs = []
for (let i = 0; i < datasets.length; i += 1) for (let j = i + 1; j < datasets.length; j += 1) { const left = datasets[i]; const right = datasets[j]; const rows = new Set(right.bars.map((bar) => JSON.stringify(bar))); const exactDuplicateRowPercent = left.bars.filter((bar) => rows.has(JSON.stringify(bar))).length / Math.min(left.bars.length, right.bars.length) * 100; pairs.push({ symbols: [left.symbol, right.symbol], returnCorrelation: correlation(left.bars, right.bars), exactDuplicateRowPercent, sameFile: left.filename === right.filename }) }
const report = { generatedAt: new Date().toISOString(), assets: datasets.map(({ symbol, filename, bars, sha256 }) => ({ symbol, datasetId: symbol.toLowerCase(), filename, sha256, barCount: bars.length, timestampRange: [bars[0].timestamp, bars.at(-1).timestamp], first10: bars.slice(0, 10), last10: bars.slice(-10) })), pairs, releaseBlockers: pairs.filter((pair) => pair.sameFile || pair.exactDuplicateRowPercent === 100) }
writeFileSync('docs/data-audit-report.json', `${JSON.stringify(report, null, 2)}\n`)
console.log(`Wrote docs/data-audit-report.json; ${report.releaseBlockers.length} release blockers.`)
