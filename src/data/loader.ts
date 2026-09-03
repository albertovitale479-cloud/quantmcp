import { parseContinuousFutures } from './parser'
import type { DatasetSource, MarketDataset } from './types'

const defaultWindowBytes = 2_500_000

/** Loads deployable real demo bars from Vite's public directory using browser-safe relative paths. */
export async function loadDataset(source: DatasetSource, windowBytes = defaultWindowBytes): Promise<MarketDataset> {
  const url = `/data/${encodeURIComponent(source.filename)}`
  const head = await fetch(url, { method: 'HEAD' })
  if (!head.ok) throw new Error(`Unable to access ${source.filename} (${head.status}).`)
  const size = Number(head.headers.get('content-length')); const start = Number.isFinite(size) && size > windowBytes ? size - windowBytes : 0
  const response = await fetch(url, { headers: start ? { Range: `bytes=${start}-` } : undefined })
  if (!response.ok && response.status !== 206) throw new Error(`Unable to load ${source.filename} (${response.status}).`)
  let text = await response.text(); if (start) text = text.slice(text.indexOf('\n') + 1)
  const parsed = parseContinuousFutures(text); const bars = parsed.bars
  return {
    id: source.id, label: source.label, timeframe: source.timeframe, bars, validation: parsed.validation, isPartial: start > 0, loadedAt: new Date().toISOString(),
    asset: { id: source.id, symbol: source.symbol, displayName: source.label, assetClass: source.assetClass, timeframe: source.timeframe, timezone: source.timezone, source: source.filename, barCount: source.auditedBarCount, startDate: bars[0]?.timestamp, endDate: bars.at(-1)?.timestamp, hasVolume: source.hasVolume },
  }
}
