import { describe, expect, it } from 'vitest'
import type { MarketDataset, OHLCVBar } from '../data/types'
import { auditDatasets } from '../data/audit'
import { availableDatasets } from '../data/datasets'
import { MAX_PARAMETER_COMBINATIONS, chronologicalSplit, optimizeParameters, runUniverseStudy } from './universeResearch'

function bars(multiplier: number): OHLCVBar[] { return Array.from({ length: 240 }, (_, index) => { const close = 100 + index * multiplier; return { timestamp: 1_700_000_000_000 + index * 60_000, open: close - .1, high: close + .2, low: close - .2, close, volume: 100 } }) }
function dataset(symbol: string, values: OHLCVBar[]): MarketDataset { return { id: symbol.toLowerCase(), label: `${symbol} continuous`, timeframe: '1m', bars: values, loadedAt: '2026-01-01T00:00:00.000Z', isPartial: false, asset: { id: symbol.toLowerCase(), symbol, displayName: `${symbol} continuous`, assetClass: 'future', timeframe: '1m', timezone: 'America/Chicago', source: `${symbol.toLowerCase()}-demo-1m.txt`, barCount: values.length, startDate: values[0].timestamp, endDate: values.at(-1)!.timestamp, hasVolume: true }, validation: { totalRows: values.length, validRows: values.length, rejectedRows: 0, duplicates: 0, missingValues: 0, malformedRows: 0, invalidOhlc: 0, invalidVolume: 0, outOfOrderRows: 0, irregularIntervals: 0, warnings: [] } } }

describe('Phase 4D causal universe research', () => {
  it('detects duplicate canonical data and incorrect source mappings as release blockers', () => {
    const a = dataset('6B', bars(1)); const b = { ...dataset('6C', bars(1)), bars: a.bars, asset: { ...dataset('6C', bars(1)).asset, source: '6b-demo-1m.txt' } }
    const report = auditDatasets([a, b], availableDatasets)
    expect(report.pairs[0].classification).toBe('exact-duplicate'); expect(report.releaseBlockers.length).toBeGreaterThan(0)
  })

  it('uses identical conditions and a common date window, while excluding low-sample assets from ranks', () => {
    const study = runUniverseStudy([dataset('NQ', bars(1)), dataset('ES', bars(.5))], { timeframe: '1m', conditions: [{ kind: 'sma', period: 3, comparator: 'above' }], forwardHorizons: [5], minimumEvents: 30 })
    expect(study.assets).toHaveLength(2); expect(study.assets.every((asset) => asset.timeframe === '1m')).toBe(true); expect(study.assets.every((asset) => asset.dateRange.start === study.commonRange.start)).toBe(true)
    const small = runUniverseStudy([dataset('NQ', bars(1))], { timeframe: '1m', conditions: [{ kind: 'sma', period: 3, comparator: 'above' }], forwardHorizons: [5], minimumEvents: 500 })
    expect(small.assets[0].rank).toBeUndefined(); expect(small.excludedSymbols).toEqual(['NQ'])
  })

  it('keeps train and test chronological and rejects an excessive grid before scanning', () => {
    const split = chronologicalSplit(bars(1), .7)
    expect(split.trainRange.end).toBeLessThan(split.testRange.start)
    expect(() => optimizeParameters(dataset('NQ', bars(1)), { timeframe: '1m', conditions: [{ kind: 'sma', period: 3, comparator: 'above' }], parameterSpace: { smaPeriod: Array.from({ length: MAX_PARAMETER_COMBINATIONS + 1 }, (_, index) => index + 1) }, forwardHorizon: 5 })).toThrow(/maximum/)
  })

  it('returns deterministic neighbor-aware candidates with untouched OOS metrics', () => {
    const input = { timeframe: '1m' as const, conditions: [{ kind: 'sma' as const, period: 3, comparator: 'above' as const }], parameterSpace: { smaPeriod: [2, 3, 4] }, forwardHorizon: 5, minimumEvents: 10 }
    const first = optimizeParameters(dataset('NQ', bars(1)), input); const second = optimizeParameters(dataset('NQ', bars(1)), input)
    expect(first.combinationsTested).toBe(3); expect(first.candidates).toEqual(second.candidates); expect(first.candidates[0].test.usableSampleCount).toBeGreaterThan(0); expect(first.candidates[1].neighborCount).toBeGreaterThan(0)
  })
})
