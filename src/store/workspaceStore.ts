import { useSyncExternalStore } from 'react'
import { availableTimeframes } from '../data/timeframeAggregator'
import { availableDatasets } from '../data/datasets'
import type { WorkspaceActions, WorkspaceState, WorkspaceStore } from './types'

const initialState: WorkspaceState = { activeAsset: null, activeTimeframe: '1m', availableTimeframes, canonicalDataset: null, selectedDataset: null, visibleChartRange: null, activeIndicators: [], researchConditions: [], marketEvents: [], selectedEventId: null, eventStudyResults: [], chartAnnotations: [], researchFindings: [], agentActivity: [], researchUniverse: availableDatasets.map((source) => source.symbol), universeStudy: null, parameterSearch: null, historicalTrades: [], selectedTradeId: null, tradeStudyStatistics: null, quantitativeMetrics: [], loading: false, error: null }
let state = initialState
const listeners = new Set<() => void>()
function update(partial: Partial<WorkspaceState>) { state = { ...state, ...partial }; listeners.forEach((listener) => listener()) }

const actions: WorkspaceActions = {
  setActiveAsset: (activeAsset) => update({ activeAsset }),
  selectDataset: (selectedDataset) => update({ canonicalDataset: selectedDataset, selectedDataset, activeAsset: selectedDataset ? { symbol: selectedDataset.asset.symbol, datasetId: selectedDataset.id } : null, activeTimeframe: '1m', researchConditions: [], marketEvents: [], selectedEventId: null, eventStudyResults: [], visibleChartRange: null, chartAnnotations: [], historicalTrades: [], selectedTradeId: null, tradeStudyStatistics: null }),
  // Research values are bar-indexed, so a timeframe switch deliberately clears them.
  setTimeframeDataset: (selectedDataset, activeTimeframe, quantitativeMetrics) => update({ selectedDataset, activeTimeframe, quantitativeMetrics, researchConditions: [], marketEvents: [], selectedEventId: null, eventStudyResults: [], visibleChartRange: null, chartAnnotations: [], historicalTrades: [], selectedTradeId: null, tradeStudyStatistics: null }),
  setVisibleChartRange: (visibleChartRange) => update({ visibleChartRange }), setActiveIndicators: (activeIndicators) => update({ activeIndicators }), setResearchConditions: (researchConditions) => update({ researchConditions }),
  setEvents: (marketEvents) => update({ marketEvents, selectedEventId: null }), selectEvent: (selectedEventId) => update({ selectedEventId }),
  setEventStudyResults: (eventStudyResults) => update({ eventStudyResults }), setQuantitativeMetrics: (quantitativeMetrics) => update({ quantitativeMetrics }),
  addChartAnnotation: (annotation) => update({ chartAnnotations: [...state.chartAnnotations, annotation] }), addResearchFinding: (finding) => update({ researchFindings: [...state.researchFindings, finding] }),
  setResearchUniverse: (researchUniverse) => update({ researchUniverse: [...new Set(researchUniverse)] }), setUniverseStudy: (universeStudy) => update({ universeStudy }), setParameterSearch: (parameterSearch) => update({ parameterSearch }),
  setHistoricalTrades: (historicalTrades, tradeStudyStatistics) => update({ historicalTrades, tradeStudyStatistics, selectedTradeId: historicalTrades[0]?.id ?? null }), selectTrade: (selectedTradeId) => update({ selectedTradeId }),
  clearResearchState: () => update({ researchConditions: [], marketEvents: [], selectedEventId: null, eventStudyResults: [], chartAnnotations: [], researchFindings: [], visibleChartRange: null, historicalTrades: [], selectedTradeId: null, tradeStudyStatistics: null }),
  addAgentActivity: (entry) => update({ agentActivity: [...state.agentActivity.slice(-49), entry] }), updateAgentActivity: (id, partial) => update({ agentActivity: state.agentActivity.map((entry) => entry.id === id ? { ...entry, ...partial } : entry) }),
  setLoading: (loading) => update({ loading }), setError: (error) => update({ error }),
}
export const workspaceStore: WorkspaceStore = {
  get activeAsset() { return state.activeAsset }, get activeTimeframe() { return state.activeTimeframe }, get availableTimeframes() { return state.availableTimeframes },
  get canonicalDataset() { return state.canonicalDataset }, get selectedDataset() { return state.selectedDataset }, get visibleChartRange() { return state.visibleChartRange },
  get activeIndicators() { return state.activeIndicators }, get researchConditions() { return state.researchConditions }, get marketEvents() { return state.marketEvents }, get selectedEventId() { return state.selectedEventId }, get eventStudyResults() { return state.eventStudyResults },
  get chartAnnotations() { return state.chartAnnotations }, get researchFindings() { return state.researchFindings }, get agentActivity() { return state.agentActivity }, get quantitativeMetrics() { return state.quantitativeMetrics },
  get researchUniverse() { return state.researchUniverse }, get universeStudy() { return state.universeStudy }, get parameterSearch() { return state.parameterSearch },
  get historicalTrades() { return state.historicalTrades }, get selectedTradeId() { return state.selectedTradeId }, get tradeStudyStatistics() { return state.tradeStudyStatistics },
  get loading() { return state.loading }, get error() { return state.error }, ...actions,
}
export const getWorkspaceState = () => state
export function useWorkspaceState(): WorkspaceState { return useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener) }, () => state, () => initialState) }
