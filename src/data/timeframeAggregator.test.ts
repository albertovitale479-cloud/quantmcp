import { describe, expect, it } from 'vitest'
import type { MarketDataset, OHLCVBar } from './types'
import { aggregateTimeframeBars, deriveTimeframeDataset } from './timeframeAggregator'
import { setTimeframe } from '../services/workspaceService'
import { compareTimeframes } from '../services/workspaceService'
import { scanMarketConditions } from '../quant/marketScanner'
import { getWorkspaceState, workspaceStore } from '../store/workspaceStore'

const minute = 60_000
const bars: OHLCVBar[] = [
  { timestamp: 0, open: 10, high: 12, low: 9, close: 11, volume: 2 },
  { timestamp: minute, open: 11, high: 14, low: 10, close: 13, volume: 3 },
  { timestamp: 2 * minute, open: 13, high: 13.5, low: 8, close: 9, volume: 5 },
  { timestamp: 3 * minute, open: 9, high: 10, low: 7, close: 8, volume: 7 },
  { timestamp: 4 * minute, open: 8, high: 11, low: 7.5, close: 10, volume: 11 },
  { timestamp: 5 * minute, open: 10, high: 12, low: 9, close: 11, volume: 13 },
  { timestamp: 6 * minute, open: 11, high: 13, low: 10, close: 12, volume: 17 },
]
const dataset: MarketDataset = { id: 'aggregation-test', label: 'Aggregation test', timeframe: '1m', bars, loadedAt: '2026-01-01T00:00:00.000Z', isPartial: false, asset: { id: 'aggregation-test', symbol: 'TEST', displayName: 'Aggregation test', assetClass: 'future', timeframe: '1m', timezone: 'America/Chicago', source: 'fixture', barCount: bars.length, startDate: 0, endDate: bars.at(-1)?.timestamp, hasVolume: true }, validation: { totalRows: bars.length, validRows: bars.length, rejectedRows: 0, duplicates: 0, missingValues: 0, malformedRows: 0, invalidOhlc: 0, invalidVolume: 0, outOfOrderRows: 0, irregularIntervals: 0, warnings: [] } }

describe('deterministic timeframe aggregation', () => {
  it('uses first open, extrema, final close, and summed volume for a five-minute bucket', () => {
    const [aggregate] = aggregateTimeframeBars(bars, '5m')
    expect(aggregate).toEqual({ timestamp: 0, open: 10, high: 14, low: 7, close: 10, volume: 28 })
  })

  it('retains an incomplete final bucket without fabricating bars', () => {
    const output = aggregateTimeframeBars(bars, '5m')
    expect(output).toHaveLength(2); expect(output[1]).toMatchObject({ timestamp: 5 * minute, open: 10, high: 13, low: 9, close: 12, volume: 30 })
  })

  it('uses deterministic clock alignment and returns chronological bars', () => {
    const offsetBars = bars.slice(1, 6)
    const output = aggregateTimeframeBars(offsetBars, '5m')
    expect(output.map((bar) => bar.timestamp)).toEqual([0, 5 * minute])
    expect(output.every((bar, index) => index === 0 || bar.timestamp > output[index - 1].timestamp)).toBe(true)
  })

  it('does not fabricate volume when a source bucket has missing volume', () => {
    const withoutVolume = bars.map((bar, index) => index === 2 ? { ...bar, volume: undefined } : bar)
    expect(aggregateTimeframeBars(withoutVolume, '5m')[0].volume).toBeUndefined()
  })

  it('caches derived views, clears incompatible state on switch, and leaves scans no-lookahead', () => {
    const derived = deriveTimeframeDataset(dataset, '5m')
    expect(deriveTimeframeDataset(dataset, '5m')).toBe(derived)
    workspaceStore.selectDataset(dataset); workspaceStore.setEvents([{ id: 'old', timestamp: 0, barIndex: 0, assetSymbol: 'TEST', conditionsMatched: [], values: {} }])
    const result = setTimeframe('5m')
    expect(result.aggregatedBarCount).toBe(2); expect(getWorkspaceState().selectedDataset?.timeframe).toBe('5m'); expect(getWorkspaceState().marketEvents).toEqual([])
    const events = scanMarketConditions(derived.bars, 'TEST', [{ kind: 'sma', period: 2, comparator: 'above' }])
    expect(events.every((event) => event.barIndex >= 1)).toBe(true)
  })

  it('rejects an unsupported active timeframe', () => {
    expect(() => setTimeframe('2m')).toThrow(/Unsupported timeframe/)
  })

  it('compares cached views without changing the active human timeframe', () => {
    workspaceStore.selectDataset(dataset); setTimeframe('5m')
    const comparison = compareTimeframes({ timeframes: ['1m', '5m'], conditions: [{ kind: 'sma', period: 2, comparator: 'above' }], forwardHorizons: [1] })
    expect(comparison.comparisons.map((entry) => entry.timeframe)).toEqual(['1m', '5m'])
    expect(getWorkspaceState().activeTimeframe).toBe('5m')
  })
})
