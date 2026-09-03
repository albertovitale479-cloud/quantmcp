import type { OHLCVBar, QuantMetric } from '../data/types'
import { simpleReturns } from './indicators'
export interface MarketStatistics { cumulativeReturn: number; averageReturn: number; medianReturn: number; standardDeviation: number; maxDrawdown: number; currentDrawdown: number; positiveReturnPercentage: number; highLowRange: number; annualizedVolatility?: number }
const valid = (values: number[]) => values.filter(Number.isFinite)
export function median(values: number[]): number { const sorted = [...values].sort((a, b) => a - b); if (!sorted.length) return Number.NaN; const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2 }
export function standardDeviation(values: number[]): number { if (!values.length) return Number.NaN; const average = values.reduce((sum, value) => sum + value, 0) / values.length; return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length) }
export function calculateStatistics(bars: OHLCVBar[]): MarketStatistics {
  const returns = valid(simpleReturns(bars)); const averageReturn = returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : Number.NaN
  let peak = -Infinity; let maxDrawdown = 0; let currentDrawdown = Number.NaN
  for (const bar of bars) { peak = Math.max(peak, bar.close); const drawdown = bar.close / peak - 1; maxDrawdown = Math.min(maxDrawdown, drawdown); currentDrawdown = drawdown }
  const high = Math.max(...bars.map((bar) => bar.high)); const low = Math.min(...bars.map((bar) => bar.low))
  return { cumulativeReturn: bars.length > 1 ? bars.at(-1)!.close / bars[0].close - 1 : Number.NaN, averageReturn, medianReturn: median(returns), standardDeviation: standardDeviation(returns), maxDrawdown, currentDrawdown, positiveReturnPercentage: returns.length ? returns.filter((value) => value > 0).length / returns.length : Number.NaN, highLowRange: bars.length ? high / low - 1 : Number.NaN }
}
export function statisticsAsMetrics(bars: OHLCVBar[]): QuantMetric[] { const stats = calculateStatistics(bars); return [['cumulative-return', 'Cumulative return', stats.cumulativeReturn], ['average-return', 'Average bar return', stats.averageReturn], ['max-drawdown', 'Maximum drawdown', stats.maxDrawdown], ['win-rate', 'Positive bars', stats.positiveReturnPercentage]].map(([id, label, value]) => ({ id: String(id), label: String(label), value: Number(value), format: 'percent' as const })) }
