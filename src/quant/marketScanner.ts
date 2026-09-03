import type { MarketEvent, OHLCVBar } from '../data/types'
import { atr, ema, momentum, rollingVolatility, rollingZScore, rsi, sma } from './indicators'

export type Comparator = 'above' | 'below'
export type MarketCondition =
  | { kind: 'sma'; period: number; comparator: Comparator }
  | { kind: 'ema'; period: number; comparator: Comparator }
  | { kind: 'rsi'; period: number; comparator: Comparator; threshold: number }
  | { kind: 'atr'; period: number; comparator: Comparator; threshold: number }
  | { kind: 'volatility'; period: number; comparator: Comparator; threshold: number }
  | { kind: 'volatility-percentile'; period: number; lookback: number; comparator: Comparator; threshold: number }
  | { kind: 'z-score'; period: number; comparator: Comparator; threshold: number }
  | { kind: 'momentum'; period: number; comparator: Comparator; threshold: number }
  | { kind: 'previous-high'; period: number; comparator: Comparator }
  | { kind: 'previous-low'; period: number; comparator: Comparator }

const passes = (left: number, comparator: Comparator, right: number) => Number.isFinite(left) && (comparator === 'above' ? left > right : left < right)
const conditionLabel = (condition: MarketCondition) => {
  if ('threshold' in condition) return `${condition.kind}(${condition.period}) ${condition.comparator} ${condition.threshold}`
  return `close ${condition.comparator} ${condition.kind}(${condition.period})`
}
function priorExtreme(bars: OHLCVBar[], index: number, period: number, key: 'high' | 'low'): number { if (index < period) return Number.NaN; let extreme = bars[index - period][key]; for (let i = index - period + 1; i < index; i += 1) extreme = key === 'high' ? Math.max(extreme, bars[i][key]) : Math.min(extreme, bars[i][key]); return extreme }
function percentileAt(values: number[], index: number, lookback: number): number { if (index < lookback - 1 || !Number.isFinite(values[index])) return Number.NaN; const window = values.slice(index - lookback + 1, index + 1).filter(Number.isFinite); return window.length < lookback ? Number.NaN : window.filter((value) => value <= values[index]).length / window.length * 100 }

/** All values are computed at the matching bar using only that bar and earlier bars. */
export function scanMarketConditions(bars: OHLCVBar[], symbol: string, conditions: MarketCondition[], sharedSeriesCache?: Map<string, number[]>): MarketEvent[] {
  if (!conditions.length) return []
  const cache = sharedSeriesCache ?? new Map<string, number[]>()
  const series = (kind: string, period: number) => { const key = `${kind}-${period}`; if (!cache.has(key)) cache.set(key, kind === 'sma' ? sma(bars, period) : kind === 'ema' ? ema(bars, period) : kind === 'rsi' ? rsi(bars, period) : kind === 'atr' ? atr(bars, period) : kind === 'volatility' ? rollingVolatility(bars, period) : kind === 'z-score' ? rollingZScore(bars, period) : momentum(bars, period)); return cache.get(key)! }
  return bars.flatMap((bar, barIndex) => {
    const values: Record<string, number> = {}; const matched = conditions.every((condition) => {
      let value: number; let pass: boolean
      if (condition.kind === 'sma' || condition.kind === 'ema') { value = series(condition.kind, condition.period)[barIndex]; pass = passes(bar.close, condition.comparator, value) }
      else if (condition.kind === 'previous-high' || condition.kind === 'previous-low') { value = priorExtreme(bars, barIndex, condition.period, condition.kind === 'previous-high' ? 'high' : 'low'); pass = passes(bar.close, condition.comparator, value) }
      else if (condition.kind === 'volatility-percentile') { value = percentileAt(series('volatility', condition.period), barIndex, condition.lookback); pass = passes(value, condition.comparator, condition.threshold) }
      else { value = series(condition.kind, condition.period)[barIndex]; pass = passes(value, condition.comparator, condition.threshold) }
      values[conditionLabel(condition)] = value; return pass
    })
    return matched ? [{ id: `${symbol}-${bar.timestamp}`, timestamp: bar.timestamp, barIndex, assetSymbol: symbol, conditionsMatched: conditions.map(conditionLabel), values }] : []
  })
}
