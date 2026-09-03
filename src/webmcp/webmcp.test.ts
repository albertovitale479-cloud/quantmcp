import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MarketDataset, OHLCVBar } from '../data/types'
import { WorkspaceServiceError, activateAsset, annotateChart, calculateIndicator, calculateWorkspaceForwardReturns, focusChart, getCompactWorkspaceState, getMarketData, queryMarketConditions } from '../services/workspaceService'
import { getWorkspaceState, workspaceStore } from '../store/workspaceStore'
import { researchToolDefinitions } from './researchTools'

const bars: OHLCVBar[] = [10, 10, 10, 20, 18, 16, 17, 19].map((close, index) => ({ timestamp: 1_700_000_000_000 + index * 60_000, open: close, high: close + 1, low: close - 1, close, volume: index + 1 }))
const dataset: MarketDataset = {
  id: 'test', label: 'TEST continuous', timeframe: '1m', bars, loadedAt: '2026-01-01T00:00:00.000Z', isPartial: true,
  asset: { id: 'test', symbol: 'TEST', displayName: 'TEST continuous', assetClass: 'future', timeframe: '1m', timezone: 'America/Chicago', source: 'test.txt', barCount: bars.length, startDate: bars[0].timestamp, endDate: bars.at(-1)!.timestamp, hasVolume: true },
  validation: { totalRows: bars.length, validRows: bars.length, rejectedRows: 0, duplicates: 0, missingValues: 0, malformedRows: 0, invalidOhlc: 0, invalidVolume: 0, outOfOrderRows: 0, irregularIntervals: 0, warnings: [] },
}

function loadFixture() { workspaceStore.selectDataset(dataset); workspaceStore.setEvents([]); workspaceStore.setEventStudyResults([]); workspaceStore.setVisibleChartRange(null) }

describe('WebMCP service boundary', () => {
  it('returns a compact current workspace and enforces bounded market-data reads', () => {
    loadFixture(); const workspace = getCompactWorkspaceState(); const result = getMarketData({ maxBars: 3 })
    expect(workspace.activeAsset).toBe('TEST'); expect(workspace.activeDataset?.loadedBars).toBe(bars.length)
    expect(result.bars).toHaveLength(3); expect(result.truncated).toBe(true)
  })

  it('uses the deterministic indicator, scanner, and event-study engines', () => {
    loadFixture(); expect(calculateIndicator({ indicator: 'SMA', period: 3, maxValues: 10 }).latest.value).toBeCloseTo(17.3333333)
    const scan = queryMarketConditions({ conditions: [{ kind: 'sma', period: 3, comparator: 'above' }] })
    expect(scan.eventCount).toBeGreaterThan(0); expect(getWorkspaceState().marketEvents).toHaveLength(scan.eventCount)
    const study = calculateWorkspaceForwardReturns({ horizons: [1, 2] })
    expect(study.results).toHaveLength(2); expect(getWorkspaceState().eventStudyResults).toHaveLength(2)
  })

  it('mutates shared focus and visible annotation state', () => {
    loadFixture(); const scan = queryMarketConditions({ conditions: [{ kind: 'sma', period: 3, comparator: 'above' }] }); const event = scan.events[0]
    const focused = focusChart({ eventId: event.id }); const annotation = annotateChart({ eventId: event.id, type: 'note', label: 'Observed historical condition' })
    expect(getWorkspaceState().visibleChartRange).toEqual(focused.range); expect(getWorkspaceState().chartAnnotations.at(-1)?.id).toBe(annotation.annotation.id)
  })

  it('rejects invalid assets before attempting a load', async () => {
    await expect(activateAsset('NOT_A_SYMBOL')).rejects.toMatchObject({ code: 'INVALID_ASSET' } satisfies Partial<WorkspaceServiceError>)
  })

  it('exposes genuine bounded universe and parameter-research tools', async () => {
    const nq = { ...dataset, id: 'nq', asset: { ...dataset.asset, id: 'nq', symbol: 'NQ', source: 'nq-demo-1m.txt' } }
    workspaceStore.selectDataset(nq)
    const parameter = researchToolDefinitions.find((tool) => tool.name === 'optimize_parameters')!
    const universe = researchToolDefinitions.find((tool) => tool.name === 'run_universe_study')!
    const parameterResult = await parameter.execute({ timeframe: '1m', conditions: [{ kind: 'sma', period: 2, comparator: 'above' }], parameterSpace: { smaPeriod: [2, 3] }, forwardHorizon: 1, minimumEvents: 1 }, {} as never) as { success: boolean }
    const universeResult = await universe.execute({ assets: ['NQ'], timeframe: '1m', conditions: [{ kind: 'sma', period: 2, comparator: 'above' }], forwardHorizons: [1], minimumEvents: 1 }, {} as never) as { success: boolean }
    expect(parameterResult.success).toBe(true); expect(universeResult.success).toBe(true); expect(getWorkspaceState().universeStudy?.assets).toHaveLength(1)
  })

  it('simulates and focuses historical trades through real WebMCP tools', async () => {
    const nq = { ...dataset, id: 'nq', asset: { ...dataset.asset, id: 'nq', symbol: 'NQ', source: 'nq-demo-1m.txt' } }
    workspaceStore.selectDataset(nq); workspaceStore.setEvents([{ id: 'NQ-event', timestamp: nq.bars[1].timestamp, barIndex: 1, assetSymbol: 'NQ', conditionsMatched: ['fixture'], values: {} }])
    const simulate = researchToolDefinitions.find((tool) => tool.name === 'simulate_trades')!; const focus = researchToolDefinitions.find((tool) => tool.name === 'focus_trade')!
    const simulation = await simulate.execute({ direction: 'long', entryRule: 'next_bar_open', stop: { type: 'fixed_percent', percent: .05 }, target: { type: 'r_multiple', multiple: 2 }, maxHoldingBars: 3, collisionPolicy: 'stop_first' }, {} as never) as { success: boolean }
    const tradeId = getWorkspaceState().historicalTrades[0].id; const focused = await focus.execute({ tradeId }, {} as never) as { success: boolean }
    expect(simulation.success).toBe(true); expect(focused.success).toBe(true); expect(getWorkspaceState().selectedTradeId).toBe(tradeId)
  })
})

describe('WebMCP lifecycle', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

  it('degrades safely when the browser API is absent', async () => {
    const lifecycle = await import('./registerTools')
    await expect(lifecycle.registerWebMcpTools()).resolves.toBe('unavailable')
  })

  it('registers each native tool once when called repeatedly', async () => {
    const registerTool = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('document', { modelContext: { registerTool } })
    const lifecycle = await import('./registerTools')
    await Promise.all([lifecycle.registerWebMcpTools(), lifecycle.registerWebMcpTools()])
    expect(lifecycle.getWebMcpRegistrationStatus()).toBe('registered')
    expect(registerTool).toHaveBeenCalledTimes(lifecycle.registeredWebMcpToolNames.length)
  })
})
