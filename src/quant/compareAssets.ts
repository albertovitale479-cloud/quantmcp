import type { MarketDataset } from '../data/types'

export interface AssetComparisonRequest {
  metric: 'return' | 'volatility' | 'correlation' | string
  startTimestamp?: string
  endTimestamp?: string
}

export interface AssetComparisonResult {
  metric: string
  values: Array<{ datasetId: string; symbol: string; value: number }>
}

/** Planned cross-asset comparison implementation. */
export declare function compareAssets(
  datasets: MarketDataset[],
  request: AssetComparisonRequest,
): AssetComparisonResult
