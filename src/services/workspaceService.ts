import { availableDatasets } from '../data/datasets'
import { loadDataset } from '../data/loader'
import { availableTimeframes, deriveTimeframeDataset } from '../data/timeframeAggregator'
import type { ChartAnnotation, ChartRange, MarketDataset, MarketEvent, OHLCVBar, ResearchFinding, SupportedTimeframe } from '../data/types'
import { calculateForwardReturns, type ForwardReturnSummary } from '../quant/eventStudy'
import { atr, ema, momentum, rollingStandardDeviation, rollingVolatility, rollingZScore, rsi, sma } from '../quant/indicators'
import { type MarketCondition, scanMarketConditions } from '../quant/marketScanner'
import { statisticsAsMetrics } from '../quant/statistics'
import { getWorkspaceState, workspaceStore } from '../store/workspaceStore'
import { applyParameters, optimizeParameters, optimizeUniverse, runUniverseStudy, type ParameterSpace } from '../quant/universeResearch'
import { simulateTrades, tradeStudyStatistics, type TradeSimulationConfig } from '../quant/tradeSimulator'

const maximumBars = 500
const maximumConditions = 6
const maximumHorizons = 8
const indicatorNames = ['SMA', 'EMA', 'RSI', 'ATR', 'ROLLING_VOLATILITY', 'ROLLING_STANDARD_DEVIATION', 'ROLLING_Z_SCORE', 'MOMENTUM'] as const

export type IndicatorName = typeof indicatorNames[number]
export type ToolErrorCode = 'INVALID_ASSET' | 'INVALID_RANGE' | 'UNSUPPORTED_INDICATOR' | 'INSUFFICIENT_HISTORY' | 'NO_ACTIVE_DATASET' | 'NO_MARKET_EVENTS' | 'INVALID_CONDITION' | 'INVALID_INPUT'

export class WorkspaceServiceError extends Error {
  constructor(public readonly code: ToolErrorCode, message: string) { super(message) }
}

export interface RangeInput { start?: number; end?: number }
export interface MarketDataInput extends RangeInput { asset?: string; maxBars?: number }
export interface IndicatorInput extends MarketDataInput { indicator: IndicatorName; period: number; maxValues?: number }
export interface ConditionInput { asset?: string; conditions: MarketCondition[] }
export interface ForwardReturnsInput { asset?: string; eventIds?: string[]; horizons: number[] }
export interface FocusInput extends RangeInput { eventId?: string }
export interface AnnotationInput { eventId?: string; timestamp?: number; type: ChartAnnotation['type']; label: string; description?: string }
export interface FindingInput { title: string; summary: string; confidence: ResearchFinding['confidence']; relatedEventIds?: string[] }
export interface CompareTimeframesInput { asset?: string; timeframes: SupportedTimeframe[]; conditions: MarketCondition[]; forwardHorizons: number[] }
export interface UniverseStudyInput { assets?: string[] | 'all'; timeframe: SupportedTimeframe; conditions: MarketCondition[]; forwardHorizons: number[]; minimumEvents?: number }
export interface OptimizeParametersInput { asset?: string; timeframe: SupportedTimeframe; conditions: MarketCondition[]; parameterSpace: ParameterSpace; forwardHorizon: number; trainRatio?: number; minimumEvents?: number }
export interface OptimizeUniverseInput { assets?: string[] | 'all'; timeframe: SupportedTimeframe; conditions: MarketCondition[]; parameterSpace: ParameterSpace; forwardHorizon: number; minimumEvents?: number }
export interface SimulateTradesInput extends TradeSimulationConfig { asset?: string; timeframe?: SupportedTimeframe; eventIds?: string[] }

const universeCache = new Map<string, Promise<MarketDataset>>()
let backgroundRequestId = 0
let researchWorker: Worker | null = null
const workerDatasetIds = new Set<string>()

/** Keeps CPU-heavy grid scans off the UI thread; Node-based tests retain a deterministic synchronous fallback. */
function runResearchInBackground<T>(task: 'universe-study' | 'parameter-search' | 'universal-search', datasets: MarketDataset[], input: unknown, fallback: () => T): Promise<T> {
  if (typeof Worker === 'undefined') return Promise.resolve(fallback())
  return new Promise<T>((resolve, reject) => {
    const worker = researchWorker ?? new Worker(new URL('../quant/researchWorker.ts', import.meta.url), { type: 'module' })
    researchWorker = worker
    const id = ++backgroundRequestId
    const uncachedDatasets = datasets.filter((dataset) => !workerDatasetIds.has(dataset.id))
    worker.onmessage = (event: MessageEvent<{ id: number; result?: T; error?: string }>) => {
      if (event.data.id !== id) return
      if (event.data.error) reject(new Error(event.data.error))
      else resolve(event.data.result as T)
    }
    worker.onerror = (event) => {
      worker.terminate(); researchWorker = null; workerDatasetIds.clear()
      reject(new Error(event.message || 'Background research worker failed.'))
    }
    uncachedDatasets.forEach((dataset) => workerDatasetIds.add(dataset.id))
    worker.postMessage({ id, task, datasets: uncachedDatasets, datasetIds: datasets.map((dataset) => dataset.id), input })
  })
}

/** Lets React paint a truthful pre-flight state before CPU-heavy deterministic research begins. */
const nextPaint = () => new Promise<void>((resolve) => setTimeout(resolve, 0))
async function withResearchProgress<T>(operation: string, total: number, action: () => T | Promise<T>) {
  workspaceStore.setLoading(true); workspaceStore.setError(null)
  workspaceStore.setProgress({ operation, stage: 'Preparing cached market windows', completed: 1, total })
  try {
    await nextPaint()
    workspaceStore.setProgress({ operation, stage: 'Calculating in the background — chart remains interactive', completed: Math.max(2, Math.floor(total * .15)), total })
    const result = await action()
    workspaceStore.setProgress({ operation, stage: 'Ranking out-of-sample evidence', completed: total, total })
    return result
  } finally {
    workspaceStore.setLoading(false); workspaceStore.setProgress(null)
  }
}

function requireInteger(value: number, message: string) {
  if (!Number.isInteger(value) || value < 1) throw new WorkspaceServiceError('INVALID_INPUT', message)
}

function getSource(asset: string) {
  const source = availableDatasets.find((candidate) => candidate.symbol === asset.trim().toUpperCase())
  if (!source) throw new WorkspaceServiceError('INVALID_ASSET', `Unknown asset “${asset}”. Available assets: ${availableDatasets.map((item) => item.symbol).join(', ')}.`)
  return source
}

function selectedUniverse(assets?: string[] | 'all') {
  const requested = assets === 'all' ? availableDatasets.map((source) => source.symbol) : assets ?? getWorkspaceState().researchUniverse
  const unique = [...new Set(requested.map((asset) => asset.trim().toUpperCase()))]
  if (!unique.length) throw new WorkspaceServiceError('INVALID_INPUT', 'Select at least one research-universe asset.')
  return unique.map(getSource)
}

async function loadUniverse(sources: ReturnType<typeof selectedUniverse>) {
  const active = getWorkspaceState().canonicalDataset
  return Promise.all(sources.map((source) => {
    if (active?.id === source.id) return Promise.resolve(active)
    let pending = universeCache.get(source.id)
    if (!pending) { pending = loadDataset(source); universeCache.set(source.id, pending) }
    return pending
  }))
}

function resolveDataset(asset?: string): MarketDataset {
  const dataset = getWorkspaceState().selectedDataset
  if (!dataset) throw new WorkspaceServiceError('NO_ACTIVE_DATASET', 'No market dataset is loaded. Call set_active_asset first.')
  if (asset && dataset.asset.symbol !== asset.trim().toUpperCase()) throw new WorkspaceServiceError('INVALID_ASSET', `${asset.toUpperCase()} is not the active loaded dataset. Call set_active_asset before requesting its data.`)
  return dataset
}

function rangeFor(dataset: MarketDataset, input: RangeInput): ChartRange {
  const from = input.start ?? dataset.bars[0]?.timestamp
  const to = input.end ?? dataset.bars.at(-1)?.timestamp
  if (!Number.isFinite(from) || !Number.isFinite(to) || from! >= to!) throw new WorkspaceServiceError('INVALID_RANGE', 'start and end must be valid Unix-millisecond timestamps with start before end.')
  if (from! < dataset.bars[0].timestamp || to! > dataset.bars.at(-1)!.timestamp) throw new WorkspaceServiceError('INVALID_RANGE', 'The requested range must fall within the loaded dataset range.')
  return { from: from!, to: to! }
}

function barsInRange(dataset: MarketDataset, input: RangeInput) {
  const range = rangeFor(dataset, input)
  return { range, bars: dataset.bars.filter((bar) => bar.timestamp >= range.from && bar.timestamp <= range.to) }
}

function serialiseBar(bar: OHLCVBar) {
  return { timestamp: bar.timestamp, open: bar.open, high: bar.high, low: bar.low, close: bar.close, ...(bar.volume === undefined ? {} : { volume: bar.volume }) }
}

function validCondition(condition: MarketCondition) {
  requireInteger(condition.period, 'Each condition period must be a positive integer.')
  if (!['above', 'below'].includes(condition.comparator)) throw new WorkspaceServiceError('INVALID_CONDITION', 'Condition comparator must be above or below.')
  if ('threshold' in condition && !Number.isFinite(condition.threshold)) throw new WorkspaceServiceError('INVALID_CONDITION', 'Condition thresholds must be finite numbers.')
  if (condition.kind === 'rsi' && (condition.threshold < 0 || condition.threshold > 100)) throw new WorkspaceServiceError('INVALID_CONDITION', 'RSI thresholds must be between 0 and 100.')
  if (condition.kind === 'volatility-percentile') {
    requireInteger(condition.lookback, 'Volatility-percentile lookback must be a positive integer.')
    if (condition.threshold < 0 || condition.threshold > 100) throw new WorkspaceServiceError('INVALID_CONDITION', 'Volatility-percentile thresholds must be between 0 and 100.')
  }
}

function conditionDescription(condition: MarketCondition) {
  if (condition.kind === 'sma' || condition.kind === 'ema') return `Price ${condition.comparator === 'above' ? '>' : '<'} ${condition.kind.toUpperCase()}(${condition.period})`
  if (condition.kind === 'previous-high' || condition.kind === 'previous-low') return `Price ${condition.comparator === 'above' ? '>' : '<'} ${condition.kind.replace('-', ' ')}(${condition.period})`
  const label = condition.kind === 'volatility-percentile' ? `Volatility percentile(${condition.period}, ${condition.lookback})` : `${condition.kind.replace('-', ' ')}(${condition.period})`
  return `${label} ${condition.comparator === 'above' ? '>' : '<'} ${condition.threshold}`
}

function requireSupportedTimeframe(timeframe: string): asserts timeframe is SupportedTimeframe {
  if (!availableTimeframes.includes(timeframe as SupportedTimeframe)) throw new WorkspaceServiceError('INVALID_INPUT', `Unsupported timeframe “${timeframe}”. Supported timeframes: ${availableTimeframes.join(', ')}.`)
}

export async function activateAsset(asset: string) {
  const source = getSource(asset)
  const priorAsset = getWorkspaceState().activeAsset?.symbol ?? null
  const current = getWorkspaceState().selectedDataset
  if (!current || current.id !== source.id) {
    workspaceStore.setLoading(true)
    workspaceStore.setError(null)
    try {
      const dataset = await loadDataset(source)
      workspaceStore.selectDataset(dataset)
      workspaceStore.setEvents([])
      workspaceStore.setEventStudyResults([])
      workspaceStore.setVisibleChartRange(null)
      workspaceStore.setQuantitativeMetrics(statisticsAsMetrics(dataset.bars))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Dataset load failed.'
      workspaceStore.setError(message)
      throw new WorkspaceServiceError('INVALID_ASSET', message)
    } finally {
      workspaceStore.setLoading(false)
    }
  }
  const dataset = resolveDataset(source.symbol)
  return { previousAsset: priorAsset, activeAsset: dataset.asset.symbol, timeframe: dataset.timeframe, datasetRange: { start: dataset.asset.startDate, end: dataset.asset.endDate }, loadedBars: dataset.bars.length }
}

export async function selectDatasetForHuman(asset: string) { return activateAsset(asset) }

/** Human-only demo preparation; it clears visible research rather than inventing an agent result. */
export function clearResearchForHuman() { workspaceStore.clearResearchState() }

export function getCompactWorkspaceState() {
  const state = getWorkspaceState(); const dataset = state.selectedDataset
  const selectedEvent = state.marketEvents.find((event) => event.id === state.selectedEventId) ?? null
  return {
    activeAsset: state.activeAsset?.symbol ?? null,
    activeTimeframe: state.activeTimeframe,
    availableTimeframes: state.availableTimeframes,
    activeDataset: dataset ? { id: dataset.id, symbol: dataset.asset.symbol, label: dataset.label, loadedBars: dataset.bars.length, canonicalBars: state.canonicalDataset?.bars.length ?? dataset.bars.length, dateRange: { start: dataset.asset.startDate, end: dataset.asset.endDate }, isPartial: dataset.isPartial, timezone: dataset.asset.timezone, hasVolume: dataset.asset.hasVolume } : null,
    availableAssets: availableDatasets.map((source) => ({ symbol: source.symbol, id: source.id, timeframe: source.timeframe })),
    researchUniverse: state.researchUniverse,
    universeStudy: state.universeStudy ? { timeframe: state.universeStudy.timeframe, horizon: state.universeStudy.horizon, commonRange: state.universeStudy.commonRange, rankings: state.universeStudy.assets.map((asset) => ({ symbol: asset.symbol, rank: asset.rank ?? null, researchScore: asset.researchScore, insufficientSample: asset.outOfSampleMetrics.insufficientSample })) } : null,
    recommendedParameters: state.parameterSearch ? (() => {
      const candidate = state.parameterSearch.candidates.find((item) => !item.rejected) ?? null
      return { symbol: state.parameterSearch.symbol, timeframe: state.parameterSearch.timeframe, combinationsTested: state.parameterSearch.combinationsTested, candidate: candidate ? { parameters: candidate.parameters, outOfSampleScore: candidate.test.score, robustness: candidate.robustness, stability: candidate.stability } : null }
    })() : null,
    recommendedUniversalParameters: state.universalParameterSearch ? (() => {
      const candidate = state.universalParameterSearch.candidates[0] ?? null
      return { timeframe: state.universalParameterSearch.timeframe, combinationsTested: state.universalParameterSearch.combinationsTested, candidate: candidate ? { parameters: candidate.parameters, crossAssetScore: candidate.crossAssetScore, validAssets: candidate.perAsset.filter((item) => !item.rejected).length, assetCount: candidate.perAsset.length } : null }
    })() : null,
    visibleChartRange: state.visibleChartRange,
    activeIndicators: state.activeIndicators, researchConditions: state.researchConditions,
    selectedEvent,
    marketEventCount: state.marketEvents.length,
    eventStudy: state.eventStudyResults.length ? { horizons: state.eventStudyResults.map((item) => item.horizon), resultCount: state.eventStudyResults.length } : null,
    researchFindings: state.researchFindings.map(({ id, title, summary, confidence, createdAt, relatedEventIds }) => ({ id, title, summary, confidence, createdAt, relatedEventIds })),
    quantitativeMetrics: state.quantitativeMetrics,
    tradeStudy: state.tradeStudyStatistics ? { ...state.tradeStudyStatistics, selectedTradeId: state.selectedTradeId, selectedTrade: state.historicalTrades.find((trade) => trade.id === state.selectedTradeId) ?? null } : null,
  }
}

/** Changes the shared chart/data context without reloading the canonical source window. */
export function setTimeframe(timeframe: string) {
  requireSupportedTimeframe(timeframe)
  const state = getWorkspaceState(); const canonical = state.canonicalDataset
  if (!canonical) throw new WorkspaceServiceError('NO_ACTIVE_DATASET', 'No market dataset is loaded. Call set_active_asset first.')
  const previousTimeframe = state.activeTimeframe
  const dataset = deriveTimeframeDataset(canonical, timeframe)
  if (timeframe !== previousTimeframe) workspaceStore.setTimeframeDataset(dataset, timeframe, statisticsAsMetrics(dataset.bars))
  return { asset: dataset.asset.symbol, previousTimeframe, newTimeframe: timeframe, aggregatedBarCount: dataset.bars.length, availableDateRange: { start: dataset.asset.startDate, end: dataset.asset.endDate } }
}

export function getDatasetSummary(asset?: string) {
  const dataset = resolveDataset(asset)
  return { id: dataset.id, symbol: dataset.asset.symbol, timeframe: dataset.timeframe, loadedBars: dataset.bars.length, sourceBarCount: dataset.asset.barCount, loadedRange: { start: dataset.asset.startDate, end: dataset.asset.endDate }, isPartial: dataset.isPartial, timezone: dataset.asset.timezone, hasVolume: dataset.asset.hasVolume, validation: dataset.validation }
}

export function getMarketData(input: MarketDataInput) {
  const dataset = resolveDataset(input.asset)
  const maxBars = input.maxBars ?? 250
  requireInteger(maxBars, 'maxBars must be a positive integer.')
  if (maxBars > maximumBars) throw new WorkspaceServiceError('INVALID_INPUT', `maxBars cannot exceed ${maximumBars}.`)
  const { range, bars } = barsInRange(dataset, input)
  const bounded = bars.length > maxBars ? bars.slice(-maxBars) : bars
  return { asset: dataset.asset.symbol, timeframe: dataset.timeframe, requestedRange: range, actualRange: bounded.length ? { start: bounded[0].timestamp, end: bounded.at(-1)!.timestamp } : null, barCount: bounded.length, truncated: bars.length > bounded.length, bars: bounded.map(serialiseBar) }
}

export function calculateIndicator(input: IndicatorInput) {
  const dataset = resolveDataset(input.asset)
  requireInteger(input.period, 'period must be a positive integer.')
  if (!indicatorNames.includes(input.indicator)) throw new WorkspaceServiceError('UNSUPPORTED_INDICATOR', `Unsupported indicator ${input.indicator}.`)
  const values = input.indicator === 'SMA' ? sma(dataset.bars, input.period)
    : input.indicator === 'EMA' ? ema(dataset.bars, input.period)
      : input.indicator === 'RSI' ? rsi(dataset.bars, input.period)
        : input.indicator === 'ATR' ? atr(dataset.bars, input.period)
          : input.indicator === 'ROLLING_VOLATILITY' ? rollingVolatility(dataset.bars, input.period)
            : input.indicator === 'ROLLING_STANDARD_DEVIATION' ? rollingStandardDeviation(dataset.bars.map((bar) => bar.close), input.period)
              : input.indicator === 'ROLLING_Z_SCORE' ? rollingZScore(dataset.bars, input.period)
                : momentum(dataset.bars, input.period)
  const { range } = barsInRange(dataset, input)
  const maxValues = input.maxValues ?? 250
  requireInteger(maxValues, 'maxValues must be a positive integer.')
  if (maxValues > maximumBars) throw new WorkspaceServiceError('INVALID_INPUT', `maxValues cannot exceed ${maximumBars}.`)
  const output = dataset.bars.map((bar, index) => ({ timestamp: bar.timestamp, value: values[index] })).filter((item) => item.timestamp >= range.from && item.timestamp <= range.to && Number.isFinite(item.value))
  if (!output.length) throw new WorkspaceServiceError('INSUFFICIENT_HISTORY', `There is not enough history in the requested range for ${input.indicator}(${input.period}).`)
  const bounded = output.length > maxValues ? output.slice(-maxValues) : output
  return { asset: dataset.asset.symbol, timeframe: dataset.timeframe, indicator: input.indicator, period: input.period, requestedRange: range, valueCount: bounded.length, truncated: output.length > bounded.length, latest: bounded.at(-1)!, values: bounded }
}

export function queryMarketConditions(input: ConditionInput) {
  const dataset = resolveDataset(input.asset)
  if (!Array.isArray(input.conditions) || !input.conditions.length || input.conditions.length > maximumConditions) throw new WorkspaceServiceError('INVALID_CONDITION', `Provide between 1 and ${maximumConditions} conditions.`)
  input.conditions.forEach(validCondition)
  const events = scanMarketConditions(dataset.bars, dataset.asset.symbol, input.conditions)
  workspaceStore.setResearchConditions(input.conditions.map(conditionDescription))
  workspaceStore.setEvents(events)
  workspaceStore.setHistoricalTrades([], null)
  workspaceStore.setEventStudyResults([])
  workspaceStore.selectEvent(events[0]?.id ?? null)
  if (events[0]) focusChart({ eventId: events[0].id })
  return { asset: dataset.asset.symbol, conditionCount: input.conditions.length, eventCount: events.length, events: events.slice(0, 100).map((event) => ({ id: event.id, timestamp: event.timestamp, barIndex: event.barIndex, conditionsMatched: event.conditionsMatched })), eventListTruncated: events.length > 100 }
}

/** Promotes the best valid parameter-search result into the shared event-study context. */
export function applyRecommendedStrategy(asset?: string, options: { preserveEventStudy?: boolean } = {}) {
  const dataset = resolveDataset(asset); const state = getWorkspaceState()
  const assetCandidate = state.parameterSearch?.symbol === dataset.asset.symbol && state.parameterSearch.timeframe === dataset.timeframe ? state.parameterSearch.candidates.find((candidate) => !candidate.rejected) : undefined
  const universalCandidate = !assetCandidate && state.universalParameterSearch?.timeframe === dataset.timeframe ? state.universalParameterSearch.candidates[0] : undefined
  const recommendation = assetCandidate ? { conditions: state.parameterSearch!.conditions, parameters: assetCandidate.parameters, source: 'asset' as const } : universalCandidate ? { conditions: state.universalParameterSearch!.conditions, parameters: universalCandidate.parameters, source: 'universal' as const } : null
  if (!recommendation) throw new WorkspaceServiceError('INVALID_INPUT', 'Run Parameter Lab first, then use its valid robust region for the event study.')
  const conditions = applyParameters(recommendation.conditions, recommendation.parameters)
  const descriptions = conditions.map(conditionDescription)
  const sameStrategyAsStudy = state.researchConditions.length === descriptions.length
    && state.researchConditions.every((condition, index) => condition === descriptions[index])
  if (!options.preserveEventStudy || !sameStrategyAsStudy) {
    const result = queryMarketConditions({ asset: dataset.asset.symbol, conditions })
    return { ...result, parameterSource: recommendation.source, parameters: recommendation.parameters }
  }

  // Trade Simulation is the next stage of the same workflow. Keep a completed Event Study
  // visible when its exact saved robust settings are being reused.
  const events = scanMarketConditions(dataset.bars, dataset.asset.symbol, conditions)
  workspaceStore.setResearchConditions(descriptions)
  workspaceStore.setEvents(events)
  workspaceStore.setHistoricalTrades([], null)
  workspaceStore.selectEvent(events[0]?.id ?? null)
  if (events[0]) focusChart({ eventId: events[0].id })
  const result = { asset: dataset.asset.symbol, conditionCount: conditions.length, eventCount: events.length, events: events.slice(0, 100).map((event) => ({ id: event.id, timestamp: event.timestamp, barIndex: event.barIndex, conditionsMatched: event.conditionsMatched })), eventListTruncated: events.length > 100 }
  return { ...result, parameterSource: recommendation.source, parameters: recommendation.parameters }
}

/** Runs isolated derived-timeframe analysis and intentionally leaves the human chart untouched. */
export function compareTimeframes(input: CompareTimeframesInput) {
  const active = resolveDataset(input.asset)
  const canonical = getWorkspaceState().canonicalDataset
  if (!canonical) throw new WorkspaceServiceError('NO_ACTIVE_DATASET', 'No canonical dataset is loaded.')
  if (!Array.isArray(input.timeframes) || !input.timeframes.length) throw new WorkspaceServiceError('INVALID_INPUT', 'Provide at least one timeframe.')
  if (!Array.isArray(input.conditions) || !input.conditions.length || input.conditions.length > maximumConditions) throw new WorkspaceServiceError('INVALID_CONDITION', `Provide between 1 and ${maximumConditions} conditions.`)
  if (!Array.isArray(input.forwardHorizons) || !input.forwardHorizons.length || input.forwardHorizons.length > maximumHorizons) throw new WorkspaceServiceError('INVALID_INPUT', `Provide between 1 and ${maximumHorizons} positive horizons.`)
  input.timeframes.forEach((timeframe) => requireSupportedTimeframe(timeframe)); input.conditions.forEach(validCondition); input.forwardHorizons.forEach((horizon) => requireInteger(horizon, 'Every horizon must be a positive integer.'))
  const uniqueTimeframes = [...new Set(input.timeframes)]
  return {
    asset: active.asset.symbol,
    conditions: input.conditions.map(conditionDescription),
    comparisons: uniqueTimeframes.map((timeframe) => {
      const dataset = deriveTimeframeDataset(canonical, timeframe)
      const events = scanMarketConditions(dataset.bars, dataset.asset.symbol, input.conditions)
      return { timeframe, barCount: dataset.bars.length, eventCount: events.length, forwardReturns: calculateForwardReturns(dataset.bars, events, input.forwardHorizons).map((result) => ({ horizon: result.horizon, sampleSize: result.sampleSize, mean: result.mean, median: result.median, winRate: result.winRate })) }
    }),
  }
}

/** Reads the same source services as the chart; it neither changes the selected chart nor fabricates a progress value. */
export async function runWorkspaceUniverseStudy(input: UniverseStudyInput) {
  requireSupportedTimeframe(input.timeframe)
  if (!Array.isArray(input.conditions) || !input.conditions.length || input.conditions.length > maximumConditions) throw new WorkspaceServiceError('INVALID_CONDITION', `Provide between 1 and ${maximumConditions} conditions.`)
  input.conditions.forEach(validCondition)
  const sources = selectedUniverse(input.assets)
  const study = await withResearchProgress('Universe study', sources.length, async () => {
    const datasets = await loadUniverse(sources)
    return runResearchInBackground('universe-study', datasets, input, () => runUniverseStudy(datasets, input))
  })
  workspaceStore.setResearchUniverse(sources.map((source) => source.symbol)); workspaceStore.setUniverseStudy(study)
  return study
}

export async function optimizeWorkspaceParameters(input: OptimizeParametersInput) {
  requireSupportedTimeframe(input.timeframe); input.conditions.forEach(validCondition)
  const symbol = input.asset ?? getWorkspaceState().activeAsset?.symbol
  if (!symbol) throw new WorkspaceServiceError('NO_ACTIVE_DATASET', 'Specify an asset or load one before parameter research.')
  const source = getSource(symbol); const combinations = Object.values(input.parameterSpace).reduce((total, values) => total * (values?.length ?? 1), 1)
  const result = await withResearchProgress('Robust parameter search', combinations, async () => {
    const [dataset] = await loadUniverse([source])
    return runResearchInBackground('parameter-search', [dataset], input, () => optimizeParameters(dataset, input))
  }); workspaceStore.setParameterSearch(result)
  return result
}

export async function optimizeWorkspaceUniverse(input: OptimizeUniverseInput) {
  requireSupportedTimeframe(input.timeframe); input.conditions.forEach(validCondition)
  const sources = selectedUniverse(input.assets); const combinations = Object.values(input.parameterSpace).reduce((total, values) => total * (values?.length ?? 1), 1)
  const result = await withResearchProgress('Universal robust search', combinations * sources.length, async () => {
    const datasets = await loadUniverse(sources)
    return runResearchInBackground('universal-search', datasets, input, () => optimizeUniverse(datasets, input))
  })
  workspaceStore.setResearchUniverse(sources.map((source) => source.symbol)); workspaceStore.setUniversalParameterSearch(result)
  return result
}

export function calculateWorkspaceForwardReturns(input: ForwardReturnsInput) {
  const dataset = resolveDataset(input.asset)
  if (!Array.isArray(input.horizons) || !input.horizons.length || input.horizons.length > maximumHorizons) throw new WorkspaceServiceError('INVALID_INPUT', `Provide between 1 and ${maximumHorizons} positive horizons.`)
  input.horizons.forEach((horizon) => requireInteger(horizon, 'Every horizon must be a positive integer.'))
  const allEvents = getWorkspaceState().marketEvents.filter((event) => event.assetSymbol === dataset.asset.symbol)
  const events = input.eventIds === undefined ? allEvents : input.eventIds.map((id) => {
    const event = allEvents.find((candidate) => candidate.id === id)
    if (!event) throw new WorkspaceServiceError('NO_MARKET_EVENTS', `Event ${id} does not exist for the active dataset.`)
    return event
  })
  if (!events.length) throw new WorkspaceServiceError('NO_MARKET_EVENTS', 'No market events are available. Call query_market_conditions first.')
  const results = calculateForwardReturns(dataset.bars, events, input.horizons)
  workspaceStore.setEventStudyResults(results)
  return { asset: dataset.asset.symbol, eventCount: events.length, results: results.map(serialiseForwardResult) }
}

export function simulateWorkspaceTrades(input: SimulateTradesInput) {
  const dataset = resolveDataset(input.asset)
  if (input.timeframe && input.timeframe !== dataset.timeframe) throw new WorkspaceServiceError('INVALID_INPUT', `Trade simulation timeframe ${input.timeframe} does not match active ${dataset.timeframe}.`)
  if (!['long', 'short'].includes(input.direction)) throw new WorkspaceServiceError('INVALID_INPUT', 'direction must be long or short.')
  if (!['event_close', 'next_bar_open'].includes(input.entryRule ?? 'next_bar_open')) throw new WorkspaceServiceError('INVALID_INPUT', 'entryRule must be event_close or next_bar_open.')
  if (!['stop_first', 'target_first', 'ambiguous'].includes(input.collisionPolicy ?? 'stop_first')) throw new WorkspaceServiceError('INVALID_INPUT', 'collisionPolicy must be stop_first, target_first, or ambiguous.')
  // A manual event selection remains authoritative. Otherwise the next simulation follows the best valid robust region.
  const recommendation = input.eventIds === undefined ? (() => { try { return applyRecommendedStrategy(dataset.asset.symbol, { preserveEventStudy: true }) } catch { return null } })() : null
  const allEvents = getWorkspaceState().marketEvents.filter((event) => event.assetSymbol === dataset.asset.symbol)
  const events = input.eventIds ? input.eventIds.map((id) => { const event = allEvents.find((candidate) => candidate.id === id); if (!event) throw new WorkspaceServiceError('NO_MARKET_EVENTS', `Event ${id} does not exist for the active dataset.`); return event }) : allEvents
  if (!events.length) throw new WorkspaceServiceError('NO_MARKET_EVENTS', 'No current market events are available. Run query_market_conditions first.')
  try {
    const trades = simulateTrades(dataset.bars, events, dataset.asset.symbol, dataset.timeframe as SupportedTimeframe, input); const statistics = tradeStudyStatistics(trades)
    workspaceStore.setHistoricalTrades(trades, statistics)
    // A reviewer opening a completed simulation should land on the strongest resolved example,
    // not simply the first chronological trade.
    const recommendedTrade = trades.filter((trade) => trade.outcome !== 'ambiguous').sort((left, right) => right.realizedR - left.realizedR || left.entryTimestamp - right.entryTimestamp)[0] ?? trades[0]
    if (recommendedTrade) focusTrade(recommendedTrade.id)
    const worstTrade = trades.filter((trade) => trade.outcome !== 'ambiguous').sort((left, right) => left.realizedR - right.realizedR)[0] ?? null
    return { asset: dataset.asset.symbol, timeframe: dataset.timeframe, entryRule: input.entryRule ?? 'next_bar_open', collisionPolicy: input.collisionPolicy ?? 'stop_first', parameterSource: recommendation?.parameterSource ?? 'current_events', tradeCount: trades.length, selectedTradeId: recommendedTrade?.id ?? null, recommendedTrade: recommendedTrade ? { id: recommendedTrade.id, outcome: recommendedTrade.outcome, realizedR: recommendedTrade.realizedR, entryTimestamp: recommendedTrade.entryTimestamp } : null, worstTrade: worstTrade ? { id: worstTrade.id, outcome: worstTrade.outcome, realizedR: worstTrade.realizedR, entryTimestamp: worstTrade.entryTimestamp } : null, statistics }
  } catch (error) { throw new WorkspaceServiceError('INVALID_INPUT', error instanceof Error ? error.message : 'Trade simulation configuration is invalid.') }
}

export function focusTrade(tradeId: string) {
  const dataset = resolveDataset(); const trade = getWorkspaceState().historicalTrades.find((candidate) => candidate.id === tradeId)
  if (!trade) throw new WorkspaceServiceError('NO_MARKET_EVENTS', `Historical trade ${tradeId} does not exist in the current workspace.`)
  const start = Math.max(0, trade.entryIndex - 12); const end = Math.min(dataset.bars.length - 1, trade.exitIndex + 12)
  const range = { from: dataset.bars[start].timestamp, to: dataset.bars[end].timestamp }
  workspaceStore.selectTrade(trade.id); workspaceStore.setVisibleChartRange(range)
  return { trade, range }
}

function serialiseForwardResult(result: ForwardReturnSummary) {
  return { ...result, hasSamples: result.sampleSize > 0 }
}

export function focusChart(input: FocusInput) {
  const dataset = resolveDataset()
  let range: ChartRange; let event: MarketEvent | undefined
  if (input.eventId) {
    event = getWorkspaceState().marketEvents.find((candidate) => candidate.id === input.eventId)
    if (!event) throw new WorkspaceServiceError('NO_MARKET_EVENTS', `Event ${input.eventId} does not exist in the current workspace.`)
    const startIndex = Math.max(0, event.barIndex - 100); const endIndex = Math.min(dataset.bars.length - 1, event.barIndex + 100)
    range = { from: dataset.bars[startIndex].timestamp, to: dataset.bars[endIndex].timestamp }
    workspaceStore.selectEvent(event.id)
  } else {
    range = rangeFor(dataset, input)
  }
  workspaceStore.setVisibleChartRange(range)
  return { asset: dataset.asset.symbol, range, ...(event ? { focusedEvent: { id: event.id, timestamp: event.timestamp, barIndex: event.barIndex } } : {}) }
}

function cleanText(value: string, field: string, maximum: number) {
  const clean = value.trim().replace(/[<>]/g, '')
  if (!clean || clean.length > maximum) throw new WorkspaceServiceError('INVALID_INPUT', `${field} must contain between 1 and ${maximum} safe text characters.`)
  return clean
}

export function annotateChart(input: AnnotationInput) {
  const dataset = resolveDataset()
  const event = input.eventId ? getWorkspaceState().marketEvents.find((candidate) => candidate.id === input.eventId) : undefined
  if (input.eventId && !event) throw new WorkspaceServiceError('NO_MARKET_EVENTS', `Event ${input.eventId} does not exist in the current workspace.`)
  const timestamp = event?.timestamp ?? input.timestamp
  if (!Number.isFinite(timestamp) || !dataset.bars.some((bar) => bar.timestamp === timestamp)) throw new WorkspaceServiceError('INVALID_RANGE', 'timestamp must identify a bar in the active loaded dataset.')
  const annotation: ChartAnnotation = { id: `annotation-${timestamp}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, timestamp: timestamp!, type: input.type, label: cleanText(input.label, 'label', 120), ...(input.description ? { description: cleanText(input.description, 'description', 500) } : {}), createdBy: 'agent', createdAt: new Date().toISOString() }
  workspaceStore.addChartAnnotation(annotation)
  return { annotation }
}

export function createResearchFinding(input: FindingInput) {
  const title = cleanText(input.title, 'title', 120); const summary = cleanText(input.summary, 'summary', 600)
  if (/\b(?:strong\s+)?(?:buy|sell)\b/i.test(`${title} ${summary}`)) throw new WorkspaceServiceError('INVALID_INPUT', 'Research findings must describe historical analysis and cannot use buy or sell labels.')
  const eventIds = input.relatedEventIds ?? []
  const known = new Set(getWorkspaceState().marketEvents.map((event) => event.id))
  if (eventIds.some((id) => !known.has(id))) throw new WorkspaceServiceError('NO_MARKET_EVENTS', 'A related event ID does not exist in the current workspace.')
  const activeAsset = getWorkspaceState().activeAsset?.symbol
  const finding: ResearchFinding = { id: `finding-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title, summary, confidence: input.confidence, source: 'agent', createdAt: new Date().toISOString(), relatedAssets: activeAsset ? [activeAsset] : undefined, relatedEventIds: eventIds.length ? eventIds : undefined }
  workspaceStore.addResearchFinding(finding)
  return { finding }
}

export function getSelectedEvent() {
  const state = getWorkspaceState(); const event = state.marketEvents.find((candidate) => candidate.id === state.selectedEventId)
  if (!event) throw new WorkspaceServiceError('NO_MARKET_EVENTS', 'No market event is currently selected.')
  return { event }
}
