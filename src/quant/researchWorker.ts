/// <reference lib="webworker" />

import type { MarketDataset } from '../data/types'
import { optimizeParameters, optimizeUniverse, runUniverseStudy } from './universeResearch'

type Request =
  | { id: number; task: 'universe-study'; datasets: MarketDataset[]; datasetIds: string[]; input: Parameters<typeof runUniverseStudy>[1] }
  | { id: number; task: 'parameter-search'; datasets: MarketDataset[]; datasetIds: string[]; input: Parameters<typeof optimizeParameters>[1] }
  | { id: number; task: 'universal-search'; datasets: MarketDataset[]; datasetIds: string[]; input: Parameters<typeof optimizeUniverse>[1] }

const datasetCache = new Map<string, MarketDataset>()

self.onmessage = (event: MessageEvent<Request>) => {
  const request = event.data
  try {
    request.datasets.forEach((dataset) => datasetCache.set(dataset.id, dataset))
    const datasets = request.datasetIds.map((id) => datasetCache.get(id))
    if (datasets.some((dataset) => !dataset)) throw new Error('A cached market dataset is unavailable in the background worker.')
    const loadedDatasets = datasets as MarketDataset[]
    const result = request.task === 'universe-study'
      ? runUniverseStudy(loadedDatasets, request.input)
      : request.task === 'parameter-search'
        ? optimizeParameters(loadedDatasets[0], request.input)
        : optimizeUniverse(loadedDatasets, request.input)
    self.postMessage({ id: request.id, result })
  } catch (error) {
    self.postMessage({ id: request.id, error: error instanceof Error ? error.message : 'Background research failed.' })
  }
}

export {}
