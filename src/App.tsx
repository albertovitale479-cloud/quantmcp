import { useCallback, useEffect, useState } from 'react'
import { AgentActivityPanel } from './components/agent-activity/AgentActivityPanel'
import { GuideModal } from './components/guide/GuideModal'
import { OnboardingModal } from './components/guide/OnboardingModal'
import { ChartPanel } from './components/chart/ChartPanel'
import { TerminalHeader } from './components/layout/TerminalHeader'
import { MetricsPanel } from './components/metrics/MetricsPanel'
import { ResearchPanel } from './components/research/ResearchPanel'
import { WatchlistSidebar } from './components/watchlist/WatchlistSidebar'
import { availableDatasets } from './data/datasets'
import type { DatasetSource } from './data/types'
import { useWorkspaceState, workspaceStore } from './store/workspaceStore'
import { calculateWorkspaceForwardReturns, clearResearchForHuman, focusChart, queryMarketConditions, selectDatasetForHuman, setTimeframe } from './services/workspaceService'
import { getRegisteredWebMcpToolCount, getWebMcpRegistrationStatus, registerWebMcpTools, subscribeWebMcpStatus } from './webmcp/registerTools'

export default function App() {
  const state = useWorkspaceState()
  const [webMcpStatus, setWebMcpStatus] = useState(getWebMcpRegistrationStatus)
  const [guideOpen, setGuideOpen] = useState(false)
  const [onboardingOpen, setOnboardingOpen] = useState(() => localStorage.getItem('quantmcp-onboarding-dismissed') !== 'true')
  useEffect(() => { const unsubscribe = subscribeWebMcpStatus(setWebMcpStatus); void registerWebMcpTools(); return unsubscribe }, [])
  useEffect(() => { void selectDatasetForHuman('NQ').catch(() => { /* The workspace exposes a load error without blocking human controls. */ }) }, [])
  const selectDataset = useCallback(async (source: DatasetSource) => {
    try { await selectDatasetForHuman(source.symbol) } catch { /* The shared service already exposes a safe UI error. */ }
  }, [])
  const runScan = useCallback(() => { try { queryMarketConditions({ conditions: [{ kind: 'sma', period: 200, comparator: 'above' }, { kind: 'rsi', period: 14, comparator: 'below', threshold: 35 }, { kind: 'volatility-percentile', period: 14, lookback: 100, comparator: 'above', threshold: 80 }] }); calculateWorkspaceForwardReturns({ horizons: [1, 5, 10, 20] }) } catch { /* The panel remains in its existing safe state. */ } }, [])
  const changeTimeframe = useCallback((timeframe: typeof state.activeTimeframe) => { try { setTimeframe(timeframe) } catch { /* The existing dataset remains visible if a switch cannot complete. */ } }, [])
  const selectEvent = useCallback((id: string | null) => { workspaceStore.selectEvent(id); if (id) { try { focusChart({ eventId: id }) } catch { /* A stale marker is ignored safely. */ } } }, [])
  const dismissOnboarding = useCallback(() => { localStorage.setItem('quantmcp-onboarding-dismissed', 'true'); setOnboardingOpen(false) }, [])
  const tryAgentDemo = useCallback(async () => { try { await selectDatasetForHuman('NQ'); setTimeframe('15m'); clearResearchForHuman(); focusChart({}); setGuideOpen(true) } catch { /* Existing human controls expose any data-load failure. */ } }, [])
  const toolCount = getRegisteredWebMcpToolCount()
  return <main className="terminal-shell"><TerminalHeader webMcpStatus={webMcpStatus} toolCount={toolCount} activeAsset={state.activeAsset?.symbol ?? null} timeframe={state.activeTimeframe} onOpenGuide={() => setGuideOpen(true)} onTryDemo={() => void tryAgentDemo()} /><div className="terminal-body"><WatchlistSidebar sources={availableDatasets} dataset={state.selectedDataset} loading={state.loading} onSelect={selectDataset} /><div className="workspace-main">{state.error && <div className="error-banner" role="alert">{state.error}</div>}{state.loading && <div className="loading-banner" role="status">Validating and loading recent source bars…</div>}<ChartPanel dataset={state.selectedDataset} events={state.marketEvents} annotations={state.chartAnnotations} visibleRange={state.visibleChartRange} selectedEventId={state.selectedEventId} timeframes={state.availableTimeframes} onSetTimeframe={changeTimeframe} onSelectEvent={selectEvent} /><div className="lower-workspace"><MetricsPanel metrics={state.quantitativeMetrics} /><ResearchPanel dataset={state.selectedDataset} events={state.marketEvents} markerCount={Math.min(state.marketEvents.length, 100)} selectedEventId={state.selectedEventId} results={state.eventStudyResults} conditions={state.researchConditions} onRun={runScan} disabled={!state.selectedDataset || state.loading} onSelect={selectEvent} /></div></div><AgentActivityPanel entries={state.agentActivity} webMcpStatus={webMcpStatus} /></div>{guideOpen && <GuideModal status={webMcpStatus} toolCount={toolCount} onClose={() => setGuideOpen(false)} />}{onboardingOpen && <OnboardingModal onDismiss={dismissOnboarding} onOpenGuide={() => setGuideOpen(true)} />}</main>
}
