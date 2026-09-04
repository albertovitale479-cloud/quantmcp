/// <reference lib="webworker" />

import type { MarketDataset } from '../data/types'
import { deriveTimeframeDataset } from '../data/timeframeAggregator'
import { calculateForwardReturns } from './eventStudy'
import { scanMarketConditions } from './marketScanner'
import { simulateTrades, tradeStudyStatistics } from './tradeSimulator'
import { optimizeParameters, optimizeUniverse, runUniverseStudy } from './universeResearch'

type ResearchTask = 'universe-study' | 'parameter-search' | 'universal-search' | 'condition-scan' | 'event-study' | 'timeframe-compare' | 'trade-simulation'
type Request = { id: number; task: ResearchTask; datasets: MarketDataset[]; datasetIds: string[]; input: unknown }

const datasetCache = new Map<string, MarketDataset>()
const datasetKey = (dataset: MarketDataset) => `${dataset.id}:${dataset.timeframe}`

self.onmessage = (event: MessageEvent<Request>) => {
  const request = event.data
  try {
    request.datasets.forEach((dataset) => datasetCache.set(datasetKey(dataset), dataset))
    const datasets = request.datasetIds.map((id) => datasetCache.get(id))
    if (datasets.some((dataset) => !dataset)) throw new Error('A cached market dataset is unavailable in the background worker.')
    const loadedDatasets = datasets as MarketDataset[]
    const report = (completed: number, total: number) => self.postMessage({ id: request.id, progress: { completed, total } })
    const result = request.task === 'universe-study'
      ? runUniverseStudy(loadedDatasets, request.input as Parameters<typeof runUniverseStudy>[1], report)
      : request.task === 'parameter-search'
        ? optimizeParameters(loadedDatasets[0], request.input as Parameters<typeof optimizeParameters>[1], undefined, report)
        : request.task === 'universal-search'
          ? optimizeUniverse(loadedDatasets, request.input as Parameters<typeof optimizeUniverse>[1], report)
          : request.task === 'condition-scan'
            ? scanMarketConditions(loadedDatasets[0].bars, loadedDatasets[0].asset.symbol, (request.input as { conditions: Parameters<typeof scanMarketConditions>[2] }).conditions)
            : request.task === 'event-study'
              ? calculateForwardReturns(loadedDatasets[0].bars, (request.input as { events: Parameters<typeof calculateForwardReturns>[1]; horizons: Parameters<typeof calculateForwardReturns>[2] }).events, (request.input as { horizons: Parameters<typeof calculateForwardReturns>[2] }).horizons)
              : request.task === 'timeframe-compare'
                ? (() => {
                  const input = request.input as { timeframes: import('../data/types').SupportedTimeframe[]; conditions: Parameters<typeof scanMarketConditions>[2]; forwardHorizons: Parameters<typeof calculateForwardReturns>[2] }
                  return input.timeframes.map((timeframe, index) => {
                    const dataset = deriveTimeframeDataset(loadedDatasets[0], timeframe)
                    const events = scanMarketConditions(dataset.bars, dataset.asset.symbol, input.conditions)
                    report(index + 1, input.timeframes.length)
                    return { timeframe, barCount: dataset.bars.length, eventCount: events.length, forwardReturns: calculateForwardReturns(dataset.bars, events, input.forwardHorizons).map((result) => ({ horizon: result.horizon, sampleSize: result.sampleSize, mean: result.mean, median: result.median, winRate: result.winRate })) }
                  })
                })()
                : (() => {
                const input = request.input as { events: Parameters<typeof simulateTrades>[1]; config: Parameters<typeof simulateTrades>[4] }
                const trades = simulateTrades(loadedDatasets[0].bars, input.events, loadedDatasets[0].asset.symbol, loadedDatasets[0].timeframe as import('../data/types').SupportedTimeframe, input.config, report)
                return { trades, statistics: tradeStudyStatistics(trades) }
              })()
    self.postMessage({ id: request.id, result })
  } catch (error) {
    self.postMessage({ id: request.id, error: error instanceof Error ? error.message : 'Background research failed.' })
  }
}

export {}
