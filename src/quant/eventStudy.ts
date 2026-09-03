import type { MarketEvent, OHLCVBar } from '../data/types'
import { median, standardDeviation } from './statistics'
export interface ForwardReturnSummary { horizon: number; sampleSize: number; mean: number; median: number; winRate: number; standardDeviation: number; minimum: number; maximum: number }
export function calculateForwardReturns(bars: OHLCVBar[], events: MarketEvent[], horizons: number[]): ForwardReturnSummary[] {
  return horizons.map((horizon) => { const returns = events.flatMap((event) => { const future = bars[event.barIndex + horizon]; const origin = bars[event.barIndex]; return future && origin ? [future.close / origin.close - 1] : [] }); return { horizon, sampleSize: returns.length, mean: returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : Number.NaN, median: median(returns), winRate: returns.length ? returns.filter((value) => value > 0).length / returns.length : Number.NaN, standardDeviation: standardDeviation(returns), minimum: returns.length ? Math.min(...returns) : Number.NaN, maximum: returns.length ? Math.max(...returns) : Number.NaN } })
}
