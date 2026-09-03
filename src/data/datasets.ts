import type { DatasetSource } from './types'
const central = 'America/Chicago'
export const availableDatasets: DatasetSource[] = [
  ['6B', '6b-demo-1m.txt', 53321], ['6C', '6c-demo-1m.txt', 49150], ['6E', '6e-demo-1m.txt', 48863], ['ES', 'es-demo-1m.txt', 48018],
  ['GC', 'gc-demo-1m.txt', 48891], ['NQ', 'nq-demo-1m.txt', 44822], ['YM', 'ym-demo-1m.txt', 58232], ['ZC', 'zc-demo-1m.txt', 53115],
].map(([symbol, filename, auditedBarCount]) => ({ id: String(symbol).toLowerCase(), filename: String(filename), symbol: String(symbol), label: `${symbol} continuous`, assetClass: 'future' as const, timeframe: '1m' as const, timezone: central, hasVolume: true, auditedBarCount: Number(auditedBarCount) }))
