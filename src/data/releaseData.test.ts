// @ts-expect-error Node file access is used only by the Vitest release-data check.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { aggregateTimeframeBars, availableTimeframes } from './timeframeAggregator'
import { parseContinuousFutures } from './parser'
import { atr, rollingVolatility, rsi, sma } from '../quant/indicators'
import { calculateForwardReturns } from '../quant/eventStudy'
import { scanMarketConditions } from '../quant/marketScanner'
import type { MarketDataset } from './types'
import { workspaceStore } from '../store/workspaceStore'
import { researchToolDefinitions } from '../webmcp/researchTools'
import { workspaceToolDefinitions } from '../webmcp/workspaceTools'
import { getWorkspaceState } from '../store/workspaceStore'

const releaseSources = [
  ['6B', '6b-demo-1m.txt', 53321], ['6C', '6c-demo-1m.txt', 49150], ['6E', '6e-demo-1m.txt', 48863], ['ES', 'es-demo-1m.txt', 48018],
  ['GC', 'gc-demo-1m.txt', 48891], ['NQ', 'nq-demo-1m.txt', 44822], ['YM', 'ym-demo-1m.txt', 58232], ['ZC', 'zc-demo-1m.txt', 53115],
] as const

function parseReleaseData(filename: string) { return parseContinuousFutures(readFileSync(`public/data/${filename}`, 'utf8')) }
function fixture(symbol: string, filename: string, bars: MarketDataset['bars']): MarketDataset {
  return { id: symbol.toLowerCase(), label: `${symbol} continuous`, timeframe: '1m', bars, loadedAt: '2026-09-03T00:00:00.000Z', isPartial: false, asset: { id: symbol.toLowerCase(), symbol, displayName: `${symbol} continuous`, assetClass: 'future', timeframe: '1m', timezone: 'America/Chicago', source: filename, barCount: bars.length, startDate: bars[0]?.timestamp, endDate: bars.at(-1)?.timestamp, hasVolume: true }, validation: { totalRows: bars.length, validRows: bars.length, rejectedRows: 0, duplicates: 0, missingValues: 0, malformedRows: 0, invalidOhlc: 0, invalidVolume: 0, outOfOrderRows: 0, irregularIntervals: 0, inferredInterval: 60_000, warnings: [] } }
}

describe('release demo datasets', () => {
  it.each(releaseSources)('%s is complete, chronological, and sufficient across all supported timeframes', (symbol, filename, expectedRows) => {
    void symbol
    const parsed = parseReleaseData(filename)
    expect(parsed.validation).toMatchObject({ totalRows: expectedRows, validRows: expectedRows, rejectedRows: 0, duplicates: 0, missingValues: 0, malformedRows: 0, invalidOhlc: 0, invalidVolume: 0, outOfOrderRows: 0, inferredInterval: 60_000 })
    expect(parsed.bars.every((bar, index) => index === 0 || bar.timestamp > parsed.bars[index - 1].timestamp)).toBe(true)
    expect(parsed.bars.every((bar) => bar.volume !== undefined && bar.volume >= 0)).toBe(true)
    expect(sma(parsed.bars, 200).filter(Number.isFinite).length).toBeGreaterThan(0)
    expect(rsi(parsed.bars, 14).filter(Number.isFinite).length).toBeGreaterThan(0)
    expect(atr(parsed.bars, 14).filter(Number.isFinite).length).toBeGreaterThan(0)
    expect(rollingVolatility(parsed.bars, 14).filter(Number.isFinite).length).toBeGreaterThan(0)
    for (const timeframe of availableTimeframes) expect(aggregateTimeframeBars(parsed.bars, timeframe).length).toBeGreaterThanOrEqual(200)
  })

  it('completes the NQ WebMCP workflow on release data with real forward samples', async () => {
    const filename = 'nq-demo-1m.txt'; const { bars } = parseReleaseData(filename); const dataset = fixture('NQ', filename, bars)
    workspaceStore.selectDataset(dataset); workspaceStore.setQuantitativeMetrics([])
    const conditions = [
      { kind: 'sma' as const, period: 200, comparator: 'above' as const },
      { kind: 'rsi' as const, period: 14, comparator: 'below' as const, threshold: 35 },
      { kind: 'volatility-percentile' as const, period: 14, lookback: 100, comparator: 'above' as const, threshold: 80 },
    ]
    const scan = await (researchToolDefinitions.find((tool) => tool.name === 'query_market_conditions')!.execute({ conditions }, {} as never) as Promise<{ success: boolean }>)
    expect(scan.success).toBe(true); expect(getWorkspaceState().marketEvents.length).toBeGreaterThan(0)
    const study = await (researchToolDefinitions.find((tool) => tool.name === 'calculate_forward_returns')!.execute({ horizons: [1, 5, 10, 20] }, {} as never) as Promise<{ success: boolean }>)
    expect(study.success).toBe(true)
    expect(getWorkspaceState().eventStudyResults.every((result) => result.sampleSize > 0)).toBe(true)
    const event = getWorkspaceState().marketEvents[0]
    const focus = await (workspaceToolDefinitions.find((tool) => tool.name === 'focus_chart_range')!.execute({ eventId: event.id }, {} as never) as Promise<{ success: boolean }>)
    const annotation = await (researchToolDefinitions.find((tool) => tool.name === 'annotate_chart')!.execute({ eventId: event.id, type: 'note', label: 'Release data validation' }, {} as never) as Promise<{ success: boolean }>)
    expect(focus.success).toBe(true); expect(annotation.success).toBe(true)
    expect(getWorkspaceState().agentActivity.slice(-4).every((entry) => entry.status === 'success')).toBe(true)
    expect(calculateForwardReturns(bars, getWorkspaceState().marketEvents, [1, 5, 10, 20]).every((result) => result.sampleSize > 0)).toBe(true)
    expect(scanMarketConditions(bars, 'NQ', conditions).length).toBe(getWorkspaceState().marketEvents.length)
  })
})
