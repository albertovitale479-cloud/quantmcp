import type { MarketEvent, OHLCVBar, SupportedTimeframe } from '../data/types'
import { atr } from './indicators'
import { median } from './statistics'

export type TradeDirection = 'long' | 'short'
export type EntryRule = 'event_close' | 'next_bar_open'
export type CollisionPolicy = 'stop_first' | 'target_first' | 'ambiguous'
export type TradeOutcome = 'target' | 'stop' | 'timeout' | 'end_of_data' | 'ambiguous'
export type StopRule = { type: 'fixed_percent'; percent: number } | { type: 'atr'; period: number; multiplier: number }
export type TargetRule = { type: 'fixed_percent'; percent: number } | { type: 'atr'; period: number; multiplier: number } | { type: 'r_multiple'; multiple: number }

export interface TradeSimulationConfig { direction: TradeDirection; entryRule?: EntryRule; stop: StopRule; target: TargetRule; maxHoldingBars: number; collisionPolicy?: CollisionPolicy }
export interface HistoricalTrade {
  id: string; asset: string; timeframe: SupportedTimeframe; direction: TradeDirection; entryIndex: number; entryTimestamp: number; entryPrice: number
  stopPrice: number; targetPrice: number; exitIndex: number; exitTimestamp: number; exitPrice: number; outcome: TradeOutcome
  riskPoints: number; rewardPoints: number; riskRewardRatio: number; realizedR: number; barsHeld: number; sourceEventId?: string; sourceConditions?: string[]
}
export interface TradeStudyStatistics { totalTrades: number; targetHits: number; stopHits: number; timeouts: number; endOfData: number; ambiguous: number; includedTrades: number; winRate: number; averageR: number; medianR: number; profitFactor: number | null; stopHitRate: number; targetHitRate: number; timeoutRate: number; maxConsecutiveLosses: number; expectancyR: number }

const validPositive = (value: number, label: string) => { if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be a finite number greater than zero.`) }
const entryFor = (event: MarketEvent, rule: EntryRule) => rule === 'event_close' ? event.barIndex : event.barIndex + 1
function distances(bars: OHLCVBar[], event: MarketEvent, entryPrice: number, stop: StopRule, target: TargetRule) {
  if (stop.type === 'fixed_percent') validPositive(stop.percent, 'stop.percent'); else { validPositive(stop.multiplier, 'stop.multiplier'); validPositive(stop.period, 'stop.period') }
  if (target.type === 'r_multiple') validPositive(target.multiple, 'target.multiple'); else if (target.type === 'fixed_percent') validPositive(target.percent, 'target.percent'); else { validPositive(target.multiplier, 'target.multiplier'); validPositive(target.period, 'target.period') }
  const stopDistance = stop.type === 'fixed_percent' ? entryPrice * stop.percent : atr(bars, stop.period)[event.barIndex] * stop.multiplier
  if (!Number.isFinite(stopDistance) || stopDistance <= 0) return null
  const targetDistance = target.type === 'r_multiple' ? stopDistance * target.multiple : target.type === 'fixed_percent' ? entryPrice * target.percent : atr(bars, target.period)[event.barIndex] * target.multiplier
  return Number.isFinite(targetDistance) && targetDistance > 0 ? { stopDistance, targetDistance } : null
}
function outcomeFor(bar: OHLCVBar, direction: TradeDirection, stop: number, target: number, policy: CollisionPolicy): TradeOutcome | null {
  const stopHit = direction === 'long' ? bar.low <= stop : bar.high >= stop; const targetHit = direction === 'long' ? bar.high >= target : bar.low <= target
  if (!stopHit && !targetHit) return null
  if (stopHit && targetHit) return policy === 'stop_first' ? 'stop' : policy === 'target_first' ? 'target' : 'ambiguous'
  return stopHit ? 'stop' : 'target'
}

/** Simulates only after a completed condition event. Default next-bar-open entry prevents using a close before it is known. */
export function simulateTrade(bars: OHLCVBar[], event: MarketEvent, asset: string, timeframe: SupportedTimeframe, config: TradeSimulationConfig): HistoricalTrade | null {
  const entryRule = config.entryRule ?? 'next_bar_open'; const collisionPolicy = config.collisionPolicy ?? 'stop_first'; validPositive(config.maxHoldingBars, 'maxHoldingBars')
  const entryIndex = entryFor(event, entryRule); const entryBar = bars[entryIndex]; if (!entryBar) return null
  const entryPrice = entryRule === 'next_bar_open' ? entryBar.open : entryBar.close; const distance = distances(bars, event, entryPrice, config.stop, config.target); if (!distance) return null
  const stopPrice = config.direction === 'long' ? entryPrice - distance.stopDistance : entryPrice + distance.stopDistance
  const targetPrice = config.direction === 'long' ? entryPrice + distance.targetDistance : entryPrice - distance.targetDistance
  const firstCheck = entryRule === 'next_bar_open' ? entryIndex : entryIndex + 1; const timeoutIndex = entryIndex + Math.floor(config.maxHoldingBars); const lastIndex = Math.min(timeoutIndex, bars.length - 1)
  let exitIndex = lastIndex; let exitPrice = bars[lastIndex].close; let outcome: TradeOutcome = timeoutIndex < bars.length ? 'timeout' : 'end_of_data'
  for (let index = firstCheck; index <= lastIndex; index += 1) { const hit = outcomeFor(bars[index], config.direction, stopPrice, targetPrice, collisionPolicy); if (!hit) continue; exitIndex = index; outcome = hit; exitPrice = hit === 'stop' ? stopPrice : hit === 'target' ? targetPrice : bars[index].close; break }
  const signedReturn = config.direction === 'long' ? exitPrice - entryPrice : entryPrice - exitPrice
  return { id: `trade-${asset}-${event.timestamp}-${config.direction}-${entryRule}`, asset, timeframe, direction: config.direction, entryIndex, entryTimestamp: entryBar.timestamp, entryPrice, stopPrice, targetPrice, exitIndex, exitTimestamp: bars[exitIndex].timestamp, exitPrice, outcome, riskPoints: distance.stopDistance, rewardPoints: distance.targetDistance, riskRewardRatio: distance.targetDistance / distance.stopDistance, realizedR: signedReturn / distance.stopDistance, barsHeld: exitIndex - entryIndex, sourceEventId: event.id, sourceConditions: event.conditionsMatched }
}

export function simulateTrades(bars: OHLCVBar[], events: MarketEvent[], asset: string, timeframe: SupportedTimeframe, config: TradeSimulationConfig) { return events.map((event) => simulateTrade(bars, event, asset, timeframe, config)).filter((trade): trade is HistoricalTrade => trade !== null) }

/** Ambiguous OHLC collisions are retained for inspection but excluded from aggregate outcome statistics. */
export function tradeStudyStatistics(trades: HistoricalTrade[]): TradeStudyStatistics {
  const included = trades.filter((trade) => trade.outcome !== 'ambiguous'); const values = included.map((trade) => trade.realizedR); const positives = values.filter((value) => value > 0); const losses = values.filter((value) => value < 0)
  let consecutive = 0; let maximum = 0; for (const value of values) { consecutive = value < 0 ? consecutive + 1 : 0; maximum = Math.max(maximum, consecutive) }
  const count = (outcome: TradeOutcome) => trades.filter((trade) => trade.outcome === outcome).length
  return { totalTrades: trades.length, targetHits: count('target'), stopHits: count('stop'), timeouts: count('timeout'), endOfData: count('end_of_data'), ambiguous: count('ambiguous'), includedTrades: included.length, winRate: values.length ? positives.length / values.length : Number.NaN, averageR: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : Number.NaN, medianR: median(values), profitFactor: losses.length ? positives.reduce((sum, value) => sum + value, 0) / Math.abs(losses.reduce((sum, value) => sum + value, 0)) : positives.length ? null : 0, stopHitRate: trades.length ? count('stop') / trades.length : Number.NaN, targetHitRate: trades.length ? count('target') / trades.length : Number.NaN, timeoutRate: trades.length ? count('timeout') / trades.length : Number.NaN, maxConsecutiveLosses: maximum, expectancyR: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : Number.NaN }
}
