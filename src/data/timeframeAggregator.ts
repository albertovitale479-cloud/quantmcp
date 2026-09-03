import type { MarketDataset, OHLCVBar, SupportedTimeframe } from './types'

export const availableTimeframes: SupportedTimeframe[] = ['1m', '5m', '15m', '30m', '1h']
const timeframeMinutes: Record<SupportedTimeframe, number> = { '1m': 1, '5m': 5, '15m': 15, '30m': 30, '1h': 60 }
const barsCache = new WeakMap<OHLCVBar[], Map<SupportedTimeframe, OHLCVBar[]>>()
const datasetCache = new WeakMap<MarketDataset, Map<SupportedTimeframe, MarketDataset>>()

/**
 * Uses fixed epoch-clock boundaries after source timestamps are normalized to
 * America/Chicago. Browser-local time is never used; incomplete buckets remain.
 */
export function aggregateTimeframeBars(sourceBars: OHLCVBar[], timeframe: SupportedTimeframe): OHLCVBar[] {
  if (timeframe === '1m') return sourceBars
  const cached = barsCache.get(sourceBars)?.get(timeframe)
  if (cached) return cached
  const duration = timeframeMinutes[timeframe] * 60_000
  const output: OHLCVBar[] = []
  let bucketStart = Number.NaN; let priorTimestamp = Number.NEGATIVE_INFINITY; let open = Number.NaN; let high = Number.NaN; let low = Number.NaN; let close = Number.NaN
  let volume = 0; let hasCompleteVolume = true
  const flush = () => { if (Number.isFinite(bucketStart)) output.push({ timestamp: bucketStart, open, high, low, close, ...(hasCompleteVolume ? { volume } : {}) }) }
  for (const bar of sourceBars) {
    if (!Number.isFinite(bar.timestamp)) throw new Error('Cannot aggregate a bar without a finite timestamp.')
    if (bar.timestamp < priorTimestamp) throw new Error('Cannot aggregate bars that are out of chronological order.')
    priorTimestamp = bar.timestamp
    const nextBucketStart = Math.floor(bar.timestamp / duration) * duration
    if (nextBucketStart !== bucketStart) {
      flush(); bucketStart = nextBucketStart; open = bar.open; high = bar.high; low = bar.low; close = bar.close
      volume = bar.volume ?? 0; hasCompleteVolume = bar.volume !== undefined
    } else {
      high = Math.max(high, bar.high); low = Math.min(low, bar.low); close = bar.close
      if (bar.volume === undefined) hasCompleteVolume = false
      else volume += bar.volume
    }
  }
  flush()
  const timeframeCache = barsCache.get(sourceBars) ?? new Map<SupportedTimeframe, OHLCVBar[]>()
  timeframeCache.set(timeframe, output); barsCache.set(sourceBars, timeframeCache)
  return output
}

/** Returns a lightweight cached view while the canonical one-minute array remains singular. */
export function deriveTimeframeDataset(canonical: MarketDataset, timeframe: SupportedTimeframe): MarketDataset {
  if (timeframe === '1m') return canonical
  const cached = datasetCache.get(canonical)?.get(timeframe)
  if (cached) return cached
  const bars = aggregateTimeframeBars(canonical.bars, timeframe)
  const derived: MarketDataset = { ...canonical, timeframe, bars, asset: { ...canonical.asset, timeframe, startDate: bars[0]?.timestamp, endDate: bars.at(-1)?.timestamp, hasVolume: bars.some((bar) => bar.volume !== undefined) } }
  const timeframeCache = datasetCache.get(canonical) ?? new Map<SupportedTimeframe, MarketDataset>()
  timeframeCache.set(timeframe, derived); datasetCache.set(canonical, timeframeCache)
  return derived
}
