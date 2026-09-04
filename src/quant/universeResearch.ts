import type { MarketDataset, OHLCVBar, SupportedTimeframe } from '../data/types'
import { deriveTimeframeDataset } from '../data/timeframeAggregator'
import { calculateForwardReturns, type ForwardReturnSummary } from './eventStudy'
import { scanMarketConditions, type MarketCondition } from './marketScanner'
import { median } from './statistics'

export const DEFAULT_MINIMUM_EVENTS = 30
export const DEFAULT_TRAIN_RATIO = 0.7
export const MAX_PARAMETER_COMBINATIONS = 1_000

export interface StudyMetrics {
  eventCount: number; usableSampleCount: number; mean: number; median: number; winRate: number; standardDeviation: number
  maxAdverse: number; score: number; insufficientSample: boolean
}
export interface ChronologicalSplit { trainStart: number; trainEnd: number; testStart: number; testEnd: number; trainRange: { start: number; end: number }; testRange: { start: number; end: number } }
export interface UniverseAssetResult {
  symbol: string; timeframe: SupportedTimeframe; dateRange: { start: number; end: number }; dataCoverage: number; metrics: StudyMetrics
  inSampleMetrics: StudyMetrics; outOfSampleMetrics: StudyMetrics; researchScore: number; rank?: number; strengths: string[]; weaknesses: string[]
}
export interface UniverseStudy { timeframe: SupportedTimeframe; conditions: MarketCondition[]; horizon: number; commonRange: { start: number; end: number }; minimumEvents: number; assets: UniverseAssetResult[]; excludedSymbols: string[] }
export type ParameterKey = 'rsiPeriod' | 'rsiThreshold' | 'smaPeriod' | 'emaPeriod' | 'volatilityPeriod' | 'volatilityPercentileThreshold' | 'volatilityLookback'
export type ParameterSpace = Partial<Record<ParameterKey, number[]>>
export interface ParameterCandidate { parameters: Record<string, number>; train: StudyMetrics; test: StudyMetrics; robustness: number; neighborCount: number; researchScore: number; stability: 'high' | 'medium' | 'low'; rejected: boolean }
export interface ParameterSearchResult { symbol: string; timeframe: SupportedTimeframe; conditions: MarketCondition[]; horizon: number; trainRatio: number; split: ChronologicalSplit; combinationsTested: number; minimumEvents: number; candidates: ParameterCandidate[]; rejectedLowSample: number }
export interface UniversalParameterCandidate { parameters: Record<string, number>; crossAssetScore: number; perAsset: ParameterCandidate[] }
export interface UniversalParameterSearchResult { timeframe: SupportedTimeframe; conditions: MarketCondition[]; combinationsTested: number; commonRange: { start: number; end: number }; candidates: UniversalParameterCandidate[] }

const finite = (value: number) => Number.isFinite(value)
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value))

/** Keeps the comparison period explicit; indicators are consequently initialized from the same common history for every symbol. */
export function commonCoverage(datasets: MarketDataset[], timeframe: SupportedTimeframe) {
  const derived = datasets.map((dataset) => deriveTimeframeDataset(dataset, timeframe))
  const start = Math.max(...derived.map((dataset) => dataset.bars[0]?.timestamp ?? Infinity))
  const end = Math.min(...derived.map((dataset) => dataset.bars.at(-1)?.timestamp ?? -Infinity))
  if (!finite(start) || !finite(end) || start >= end) throw new Error('Selected assets have no common chronological data coverage.')
  return { start, end, datasets: derived.map((dataset) => ({ ...dataset, bars: dataset.bars.filter((bar) => bar.timestamp >= start && bar.timestamp <= end), asset: { ...dataset.asset, startDate: start, endDate: end } })) }
}

/** A chronological split. The boundary bar belongs to test; no test observation selects a parameter. */
export function chronologicalSplit(bars: OHLCVBar[], trainRatio = DEFAULT_TRAIN_RATIO): ChronologicalSplit {
  if (!(trainRatio > 0.5 && trainRatio < 0.9)) throw new Error('trainRatio must be greater than 0.5 and less than 0.9.')
  const boundary = Math.floor(bars.length * trainRatio)
  if (boundary < 2 || boundary >= bars.length - 1) throw new Error('Insufficient bars for chronological train/test validation.')
  return { trainStart: 0, trainEnd: boundary, testStart: boundary, testEnd: bars.length,
    trainRange: { start: bars[0].timestamp, end: bars[boundary - 1].timestamp }, testRange: { start: bars[boundary].timestamp, end: bars.at(-1)!.timestamp } }
}

function metricsFor(bars: OHLCVBar[], symbol: string, conditions: MarketCondition[], horizon: number, start: number, end: number, minimumEvents: number, seriesCache?: Map<string, number[]>): StudyMetrics {
  // The scanner is invoked over all prior bars, but only events and their forward bar wholly inside this period are measured.
  const events = scanMarketConditions(bars, symbol, conditions, seriesCache).filter((event) => event.barIndex >= start && event.barIndex + horizon < end)
  const summary = calculateForwardReturns(bars, events, [horizon])[0]
  return makeMetrics(events.length, summary, minimumEvents)
}

function makeMetrics(eventCount: number, summary: ForwardReturnSummary, minimumEvents: number): StudyMetrics {
  const usableSampleCount = summary.sampleSize
  const insufficientSample = usableSampleCount < minimumEvents
  const mean = summary.mean; const med = summary.median; const deviation = summary.standardDeviation
  // Standardized expectancy, median confirmation, win rate, confidence and downside are independently bounded.
  const expectancy = finite(mean) && finite(deviation) && deviation > 0 ? clamp(50 + 20 * mean / deviation) : 0
  const medianComponent = finite(med) ? clamp(50 + med * 10_000) : 0
  const winComponent = finite(summary.winRate) ? summary.winRate * 100 : 0
  const confidence = clamp(usableSampleCount / minimumEvents * 100)
  const downsidePenalty = finite(summary.minimum) ? clamp(-summary.minimum * 10_000) : 100
  const score = insufficientSample ? 0 : clamp(expectancy * .30 + medianComponent * .25 + winComponent * .15 + confidence * .20 - downsidePenalty * .10)
  return { eventCount, usableSampleCount, mean, median: med, winRate: summary.winRate, standardDeviation: deviation, maxAdverse: summary.minimum, score, insufficientSample }
}

function explanations(result: Pick<UniverseAssetResult, 'inSampleMetrics' | 'outOfSampleMetrics' | 'researchScore'>) {
  const strengths: string[] = []; const weaknesses: string[] = []
  if (!result.outOfSampleMetrics.insufficientSample) strengths.push('sufficient out-of-sample event sample')
  else weaknesses.push('insufficient out-of-sample event sample')
  if (result.outOfSampleMetrics.median > 0) strengths.push('positive median out-of-sample expectancy')
  else weaknesses.push('non-positive out-of-sample median')
  if (result.outOfSampleMetrics.score >= result.inSampleMetrics.score * .7) strengths.push('consistent chronological test performance')
  else weaknesses.push('test performance materially below training')
  if (result.outOfSampleMetrics.standardDeviation > Math.abs(result.outOfSampleMetrics.mean) * 4) weaknesses.push('elevated return dispersion')
  return { strengths, weaknesses }
}

export function runUniverseStudy(datasets: MarketDataset[], input: { timeframe: SupportedTimeframe; conditions: MarketCondition[]; forwardHorizons: number[]; minimumEvents?: number }, onProgress?: (completed: number, total: number) => void): UniverseStudy {
  if (!datasets.length) throw new Error('Select at least one asset.')
  if (!input.conditions.length) throw new Error('Provide at least one supported market condition.')
  if (input.forwardHorizons.length !== 1) throw new Error('Universe rankings require exactly one forward horizon; assets are never ranked across different horizons.')
  const horizon = input.forwardHorizons[0]; const minimumEvents = input.minimumEvents ?? DEFAULT_MINIMUM_EVENTS
  if (!Number.isInteger(horizon) || horizon < 1 || !Number.isInteger(minimumEvents) || minimumEvents < 1) throw new Error('forward horizon and minimumEvents must be positive integers.')
  const coverage = commonCoverage(datasets, input.timeframe)
  const assets = coverage.datasets.map((dataset, index) => {
    const split = chronologicalSplit(dataset.bars)
    const all = metricsFor(dataset.bars, dataset.asset.symbol, input.conditions, horizon, 0, dataset.bars.length, minimumEvents)
    const train = metricsFor(dataset.bars, dataset.asset.symbol, input.conditions, horizon, split.trainStart, split.trainEnd, minimumEvents)
    const test = metricsFor(dataset.bars, dataset.asset.symbol, input.conditions, horizon, split.testStart, split.testEnd, minimumEvents)
    // OOS dominates. In-sample only rewards repeatability, never selects a high train-only spike.
    const researchScore = test.insufficientSample ? 0 : clamp(test.score * .70 + train.score * .20 + (test.score >= train.score * .7 ? 10 : 0))
    const item: UniverseAssetResult = { symbol: dataset.asset.symbol, timeframe: input.timeframe, dateRange: { start: coverage.start, end: coverage.end }, dataCoverage: dataset.bars.length, metrics: all, inSampleMetrics: train, outOfSampleMetrics: test, researchScore, strengths: [], weaknesses: [] }
    onProgress?.(index + 1, coverage.datasets.length)
    return { ...item, ...explanations(item) }
  }).sort((left, right) => right.researchScore - left.researchScore || left.symbol.localeCompare(right.symbol)).map((item, index) => ({ ...item, rank: item.researchScore > 0 ? index + 1 : undefined }))
  return { timeframe: input.timeframe, conditions: input.conditions, horizon, commonRange: { start: coverage.start, end: coverage.end }, minimumEvents, assets, excludedSymbols: assets.filter((asset) => asset.outOfSampleMetrics.insufficientSample).map((asset) => asset.symbol) }
}

function valuesFor(space: ParameterSpace) {
  const entries = Object.entries(space) as Array<[ParameterKey, number[]]>
  entries.forEach(([key, values]) => { if (!values.length || values.some((value) => !Number.isFinite(value) || value <= 0)) throw new Error(`Parameter ${key} requires finite positive values.`) })
  const count = entries.reduce((total, [, values]) => total * values.length, 1)
  if (count > MAX_PARAMETER_COMBINATIONS) throw new Error(`Parameter space contains ${count} combinations; maximum is ${MAX_PARAMETER_COMBINATIONS}. Narrow the search.`)
  const output: Record<string, number>[] = [{}]
  for (const [key, values] of entries) for (const current of [...output]) { output.splice(output.indexOf(current), 1, ...values.map((value) => ({ ...current, [key]: value }))) }
  return output
}

export function applyParameters(conditions: MarketCondition[], parameters: Record<string, number>): MarketCondition[] {
  const used = new Set<string>()
  const output = conditions.map((condition) => {
    const next = { ...condition } as MarketCondition & { period: number; threshold?: number; lookback?: number }
    if (condition.kind === 'rsi') { if ('rsiPeriod' in parameters) { next.period = parameters.rsiPeriod; used.add('rsiPeriod') }; if ('rsiThreshold' in parameters) { next.threshold = parameters.rsiThreshold; used.add('rsiThreshold') } }
    if (condition.kind === 'sma' && 'smaPeriod' in parameters) { next.period = parameters.smaPeriod; used.add('smaPeriod') }
    if (condition.kind === 'ema' && 'emaPeriod' in parameters) { next.period = parameters.emaPeriod; used.add('emaPeriod') }
    if (condition.kind === 'volatility' && 'volatilityPeriod' in parameters) { next.period = parameters.volatilityPeriod; used.add('volatilityPeriod') }
    if (condition.kind === 'volatility-percentile') { if ('volatilityPeriod' in parameters) { next.period = parameters.volatilityPeriod; used.add('volatilityPeriod') }; if ('volatilityPercentileThreshold' in parameters) { next.threshold = parameters.volatilityPercentileThreshold; used.add('volatilityPercentileThreshold') }; if ('volatilityLookback' in parameters) { next.lookback = parameters.volatilityLookback; used.add('volatilityLookback') } }
    return next
  })
  if (Object.keys(parameters).some((key) => !used.has(key))) throw new Error('A requested parameter does not correspond to a supplied supported condition.')
  return output
}

function neighbors(left: Record<string, number>, right: Record<string, number>, keys: string[]) { return keys.filter((key) => left[key] !== right[key]).length === 1 }

export function optimizeParameters(dataset: MarketDataset, input: { timeframe: SupportedTimeframe; conditions: MarketCondition[]; parameterSpace: ParameterSpace; forwardHorizon: number; trainRatio?: number; minimumEvents?: number }, seriesCache = new Map<string, number[]>(), onProgress?: (completed: number, total: number) => void): ParameterSearchResult {
  const view = deriveTimeframeDataset(dataset, input.timeframe); const split = chronologicalSplit(view.bars, input.trainRatio)
  const minimumEvents = input.minimumEvents ?? DEFAULT_MINIMUM_EVENTS; const combinations = valuesFor(input.parameterSpace); const keys = Object.keys(input.parameterSpace)
  const preliminary = combinations.map((parameters, index) => {
    const conditions = applyParameters(input.conditions, parameters)
    const train = metricsFor(view.bars, view.asset.symbol, conditions, input.forwardHorizon, split.trainStart, split.trainEnd, minimumEvents, seriesCache)
    const test = metricsFor(view.bars, view.asset.symbol, conditions, input.forwardHorizon, split.testStart, split.testEnd, minimumEvents, seriesCache)
    if ((index + 1) % 4 === 0 || index === combinations.length - 1) onProgress?.(index + 1, combinations.length)
    return { parameters, train, test }
  })
  const candidates = preliminary.map((candidate) => {
    const adjacentTrainScores = preliminary.filter((other) => other !== candidate && neighbors(candidate.parameters, other.parameters, keys)).map((other) => other.train.score)
    const neighborMedian = adjacentTrainScores.length ? median(adjacentTrainScores) : 0
    const deviation = adjacentTrainScores.length ? Math.sqrt(adjacentTrainScores.reduce((total, value) => total + (value - neighborMedian) ** 2, 0) / adjacentTrainScores.length) : 100
    const robustness = clamp(neighborMedian - deviation * .5)
    const rejected = candidate.train.insufficientSample || candidate.test.insufficientSample
    const researchScore = rejected ? 0 : clamp(candidate.test.score * .60 + candidate.train.score * .15 + robustness * .25)
    return { ...candidate, robustness, neighborCount: adjacentTrainScores.length, researchScore, stability: robustness >= 65 ? 'high' as const : robustness >= 40 ? 'medium' as const : 'low' as const, rejected }
  }).sort((left, right) => right.researchScore - left.researchScore)
  return { symbol: view.asset.symbol, timeframe: input.timeframe, conditions: input.conditions, horizon: input.forwardHorizon, trainRatio: input.trainRatio ?? DEFAULT_TRAIN_RATIO, split, combinationsTested: combinations.length, minimumEvents, candidates: candidates.slice(0, 12), rejectedLowSample: candidates.filter((candidate) => candidate.rejected).length }
}

/** One shared configuration is scored by the median asset score, with a failure penalty; a single winner cannot carry the universe. */
export function optimizeUniverse(datasets: MarketDataset[], input: { timeframe: SupportedTimeframe; conditions: MarketCondition[]; parameterSpace: ParameterSpace; forwardHorizon: number; minimumEvents?: number }, onProgress?: (completed: number, total: number) => void): UniversalParameterSearchResult {
  const coverage = commonCoverage(datasets, input.timeframe)
  const configurations = valuesFor(input.parameterSpace)
  const assetCaches = new Map(coverage.datasets.map((dataset) => [dataset.asset.symbol, new Map<string, number[]>()]))
  let completed = 0; const total = configurations.length * coverage.datasets.length
  const results = configurations.map((parameters) => {
    const perAsset = coverage.datasets.map((dataset) => {
      const candidate = optimizeParameters(dataset, { ...input, parameterSpace: Object.fromEntries(Object.entries(parameters).map(([key, value]) => [key, [value]])) as ParameterSpace }, assetCaches.get(dataset.asset.symbol)! ).candidates[0]
      onProgress?.(++completed, total)
      return candidate
    })
    const scores = perAsset.map((item) => item.researchScore); const failures = scores.filter((score) => score === 0).length
    return { parameters, crossAssetScore: clamp(median(scores) - failures / scores.length * 30), perAsset }
  }).sort((left, right) => right.crossAssetScore - left.crossAssetScore)
  return { timeframe: input.timeframe, conditions: input.conditions, combinationsTested: configurations.length, commonRange: { start: coverage.start, end: coverage.end }, candidates: results.slice(0, 8) }
}
