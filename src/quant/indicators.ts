import type { OHLCVBar } from '../data/types'

const finite = (value: number) => Number.isFinite(value)
const closes = (bars: OHLCVBar[]) => bars.map((bar) => bar.close)
export function simpleReturns(bars: OHLCVBar[]): number[] { return bars.map((bar, index) => index === 0 ? Number.NaN : bar.close / bars[index - 1].close - 1) }
export function sma(bars: OHLCVBar[], period: number): number[] {
  const result = Array<number>(bars.length).fill(Number.NaN); if (!Number.isInteger(period) || period < 1) return result
  let sum = 0; const values = closes(bars)
  for (let i = 0; i < values.length; i += 1) { sum += values[i]; if (i >= period) sum -= values[i - period]; if (i >= period - 1) result[i] = sum / period }
  return result
}
/** EMA is seeded with the first SMA(period), then uses alpha = 2 / (period + 1). */
export function ema(bars: OHLCVBar[], period: number): number[] {
  const result = Array<number>(bars.length).fill(Number.NaN); const seed = sma(bars, period); const alpha = 2 / (period + 1); let prior = Number.NaN
  for (let i = period - 1; i < bars.length; i += 1) { prior = i === period - 1 ? seed[i] : bars[i].close * alpha + prior * (1 - alpha); result[i] = prior }
  return result
}
/** Wilder RSI: initial average gain/loss uses period simple differences; subsequent values use Wilder smoothing. */
export function rsi(bars: OHLCVBar[], period = 14): number[] {
  const result = Array<number>(bars.length).fill(Number.NaN); if (period < 1 || bars.length <= period) return result
  let gains = 0; let losses = 0
  for (let i = 1; i <= period; i += 1) { const change = bars[i].close - bars[i - 1].close; gains += Math.max(change, 0); losses += Math.max(-change, 0) }
  let averageGain = gains / period; let averageLoss = losses / period
  const value = () => averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss)
  result[period] = value()
  for (let i = period + 1; i < bars.length; i += 1) { const change = bars[i].close - bars[i - 1].close; averageGain = (averageGain * (period - 1) + Math.max(change, 0)) / period; averageLoss = (averageLoss * (period - 1) + Math.max(-change, 0)) / period; result[i] = value() }
  return result
}
export function trueRange(bars: OHLCVBar[]): number[] { return bars.map((bar, index) => index === 0 ? bar.high - bar.low : Math.max(bar.high - bar.low, Math.abs(bar.high - bars[index - 1].close), Math.abs(bar.low - bars[index - 1].close))) }
/** ATR uses Wilder smoothing, seeded by the arithmetic mean of the first period true ranges. */
export function atr(bars: OHLCVBar[], period = 14): number[] {
  const result = Array<number>(bars.length).fill(Number.NaN); const ranges = trueRange(bars); if (period < 1 || bars.length < period) return result
  let prior = ranges.slice(0, period).reduce((sum, value) => sum + value, 0) / period; result[period - 1] = prior
  for (let i = period; i < bars.length; i += 1) { prior = (prior * (period - 1) + ranges[i]) / period; result[i] = prior }
  return result
}
export function rollingStandardDeviation(values: number[], period: number): number[] {
  const result = Array<number>(values.length).fill(Number.NaN); if (period < 1) return result; let sum = 0; let squares = 0
  for (let i = 0; i < values.length; i += 1) { const value = values[i]; if (!finite(value)) continue; sum += value; squares += value * value; if (i >= period && finite(values[i - period])) { sum -= values[i - period]; squares -= values[i - period] ** 2 } if (i >= period - 1) { const variance = Math.max(0, squares / period - (sum / period) ** 2); result[i] = Math.sqrt(variance) } }
  return result
}
export function momentum(bars: OHLCVBar[], period: number): number[] { return bars.map((bar, index) => index < period ? Number.NaN : bar.close / bars[index - period].close - 1) }
export function rollingVolatility(bars: OHLCVBar[], period: number): number[] { return rollingStandardDeviation(simpleReturns(bars), period) }
export function rollingZScore(bars: OHLCVBar[], period: number): number[] { const mean = sma(bars, period); const deviation = rollingStandardDeviation(closes(bars), period); return bars.map((bar, index) => finite(mean[index]) && deviation[index] > 0 ? (bar.close - mean[index]) / deviation[index] : Number.NaN) }
