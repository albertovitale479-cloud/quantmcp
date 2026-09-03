import type { AgentActivityEntry, ChartAnnotation, ChartRange, MarketDataset, MarketEvent, QuantMetric, ResearchFinding, SupportedTimeframe } from '../data/types'
import type { ForwardReturnSummary } from '../quant/eventStudy'
import type { ParameterSearchResult, UniverseStudy } from '../quant/universeResearch'
import type { HistoricalTrade, TradeStudyStatistics } from '../quant/tradeSimulator'

export interface ActiveAsset { symbol: string; datasetId?: string }
export interface WorkspaceState {
  activeAsset: ActiveAsset | null; activeTimeframe: SupportedTimeframe; availableTimeframes: SupportedTimeframe[]
  canonicalDataset: MarketDataset | null; selectedDataset: MarketDataset | null; visibleChartRange: ChartRange | null
  activeIndicators: string[]; researchConditions: string[]; marketEvents: MarketEvent[]; selectedEventId: string | null; eventStudyResults: ForwardReturnSummary[]
  chartAnnotations: ChartAnnotation[]; researchFindings: ResearchFinding[]; agentActivity: AgentActivityEntry[]
  researchUniverse: string[]; universeStudy: UniverseStudy | null; parameterSearch: ParameterSearchResult | null
  historicalTrades: HistoricalTrade[]; selectedTradeId: string | null; tradeStudyStatistics: TradeStudyStatistics | null
  quantitativeMetrics: QuantMetric[]; loading: boolean; error: string | null
}
export interface WorkspaceActions {
  setActiveAsset: (asset: ActiveAsset | null) => void; selectDataset: (dataset: MarketDataset | null) => void
  setTimeframeDataset: (dataset: MarketDataset, timeframe: SupportedTimeframe, metrics: QuantMetric[]) => void
  setVisibleChartRange: (range: ChartRange | null) => void; setActiveIndicators: (indicators: string[]) => void; setResearchConditions: (conditions: string[]) => void
  setEvents: (events: MarketEvent[]) => void; selectEvent: (eventId: string | null) => void; setEventStudyResults: (results: ForwardReturnSummary[]) => void
  setQuantitativeMetrics: (metrics: QuantMetric[]) => void; addChartAnnotation: (annotation: ChartAnnotation) => void
  addResearchFinding: (finding: ResearchFinding) => void; addAgentActivity: (entry: AgentActivityEntry) => void
  setResearchUniverse: (assets: string[]) => void; setUniverseStudy: (study: UniverseStudy | null) => void; setParameterSearch: (result: ParameterSearchResult | null) => void
  setHistoricalTrades: (trades: HistoricalTrade[], statistics: TradeStudyStatistics | null) => void; selectTrade: (tradeId: string | null) => void
  clearResearchState: () => void
  updateAgentActivity: (id: string, partial: Pick<AgentActivityEntry, 'status' | 'summary' | 'detail'>) => void
  setLoading: (loading: boolean) => void; setError: (error: string | null) => void
}
export type WorkspaceStore = WorkspaceState & WorkspaceActions
