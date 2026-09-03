import { useCallback, useEffect, useState } from 'react'
import { AgentActivityPanel } from './components/agent-activity/AgentActivityPanel'
import { ChartPanel } from './components/chart/ChartPanel'
import { TerminalHeader } from './components/layout/TerminalHeader'
import { MetricsPanel } from './components/metrics/MetricsPanel'
import { ResearchPanel } from './components/research/ResearchPanel'
import { WatchlistSidebar } from './components/watchlist/WatchlistSidebar'
import { availableDatasets } from './data/datasets'
import type { DatasetSource } from './data/types'
import { useWorkspaceState, workspaceStore } from './store/workspaceStore'
import { calculateWorkspaceForwardReturns, focusChart, queryMarketConditions, selectDatasetForHuman, setTimeframe } from './services/workspaceService'
import { getWebMcpRegistrationStatus, registerWebMcpTools, subscribeWebMcpStatus } from './webmcp/registerTools'

export default function App() {
  const state = useWorkspaceState()
  const [webMcpStatus, setWebMcpStatus] = useState(getWebMcpRegistrationStatus)
  useEffect(() => { const unsubscribe = subscribeWebMcpStatus(setWebMcpStatus); void registerWebMcpTools(); return unsubscribe }, [])
  useEffect(() => { void selectDatasetForHuman('NQ').catch(() => { /* The workspace exposes a load error without blocking human controls. */ }) }, [])
  const selectDataset = useCallback(async (source: DatasetSource) => {
    try { await selectDatasetForHuman(source.symbol) } catch { /* The shared service already exposes a safe UI error. */ }
  }, [])
  const runScan = useCallback(() => { try { queryMarketConditions({ conditions: [{ kind: 'rsi', period: 14, comparator: 'below', threshold: 30 }] }); calculateWorkspaceForwardReturns({ horizons: [1, 5, 10, 20] }) } catch { /* The panel remains in its existing safe state. */ } }, [])
  const changeTimeframe = useCallback((timeframe: typeof state.activeTimeframe) => { try { setTimeframe(timeframe) } catch { /* The existing dataset remains visible if a switch cannot complete. */ } }, [])
  const selectEvent = useCallback((id: string | null) => { workspaceStore.selectEvent(id); if (id) { try { focusChart({ eventId: id }) } catch { /* A stale marker is ignored safely. */ } } }, [])
  return <main className="terminal-shell"><TerminalHeader webMcpStatus={webMcpStatus} activeAsset={state.activeAsset?.symbol ?? null} timeframe={state.activeTimeframe} /><div className="terminal-body"><WatchlistSidebar sources={availableDatasets} dataset={state.selectedDataset} loading={state.loading} onSelect={selectDataset} /><div className="workspace-main">{state.error && <div className="error-banner" role="alert">{state.error}</div>}{state.loading && <div className="loading-banner" role="status">Validating and loading recent source bars…</div>}<ChartPanel dataset={state.selectedDataset} events={state.marketEvents} annotations={state.chartAnnotations} visibleRange={state.visibleChartRange} selectedEventId={state.selectedEventId} timeframes={state.availableTimeframes} onSetTimeframe={changeTimeframe} onSelectEvent={selectEvent} /><div className="lower-workspace"><MetricsPanel metrics={state.quantitativeMetrics} /><ResearchPanel events={state.marketEvents} selectedEventId={state.selectedEventId} results={state.eventStudyResults} conditions={state.researchConditions} onRun={runScan} disabled={!state.selectedDataset || state.loading} onSelect={selectEvent} /></div></div><AgentActivityPanel entries={state.agentActivity} /></div></main>
}
