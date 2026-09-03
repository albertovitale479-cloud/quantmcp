/** Unix timestamp in milliseconds. Source timestamps are interpreted as America/Chicago wall time. */
export type UnixTimestamp = number
/** Timeframes available to the shared human/agent research workspace. */
export type SupportedTimeframe = '1m' | '5m' | '15m' | '30m' | '1h'

export interface OHLCVBar { timestamp: UnixTimestamp; open: number; high: number; low: number; close: number; volume?: number }
export type Timeframe = SupportedTimeframe | '4h' | '1d' | '1w' | '1M' | 'unknown'
export type AssetClass = 'equity' | 'etf' | 'future' | 'fx' | 'crypto' | 'index' | 'commodity' | 'other'

export interface AssetMetadata {
  id: string; symbol: string; displayName: string; assetClass: AssetClass; timeframe: Timeframe; timezone: string; source: string; barCount?: number; startDate?: UnixTimestamp; endDate?: UnixTimestamp; hasVolume: boolean
}
export interface DatasetValidationReport {
  totalRows: number; validRows: number; rejectedRows: number; duplicates: number; missingValues: number; malformedRows: number; invalidOhlc: number; invalidVolume: number; outOfOrderRows: number; irregularIntervals: number; inferredInterval?: number; warnings: string[]
}
export interface MarketDataset { id: string; label: string; asset: AssetMetadata; timeframe: Timeframe; bars: OHLCVBar[]; validation: DatasetValidationReport; loadedAt: string; isPartial: boolean }
export interface DatasetSource { id: string; filename: string; symbol: string; label: string; assetClass: AssetClass; timeframe: Timeframe; timezone: string; hasVolume: boolean; auditedBarCount: number }
export interface ChartRange { from: UnixTimestamp; to: UnixTimestamp }
export interface QuantMetric { id: string; label: string; value: number | string | null; format: 'number' | 'percent' | 'currency' | 'ratio' | 'text'; description?: string }
export interface MarketEvent { id: string; timestamp: UnixTimestamp; barIndex: number; assetSymbol: string; conditionsMatched: string[]; values: Record<string, number> }
export interface ChartAnnotation { id: string; timestamp: UnixTimestamp; type: 'note' | 'line' | 'range' | 'marker'; label: string; description?: string; createdBy: 'human' | 'agent'; createdAt: string }
export interface ResearchFinding { id: string; title: string; summary: string; confidence: 'low' | 'medium' | 'high'; source: 'human' | 'agent' | 'quant-engine'; createdAt: string; relatedAssets?: string[]; relatedEventIds?: string[] }
export interface AgentActivityEntry { id: string; timestamp: string; tool: string; status: 'queued' | 'running' | 'success' | 'error'; summary: string; detail?: string }
