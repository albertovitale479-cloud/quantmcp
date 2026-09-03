import { describe, expect, it } from 'vitest'
import type { MarketEvent, OHLCVBar } from '../data/types'
import { simulateTrade, tradeStudyStatistics, type TradeSimulationConfig } from './tradeSimulator'

let fixtureBars: OHLCVBar[] = []
function bars(values: Array<[number, number?, number?, number?]>) { fixtureBars = values.map(([open, high, low, close], index) => ({ timestamp: 1_700_000_000_000 + index * 60_000, open, high: high ?? open + .5, low: low ?? open - .5, close: close ?? open, volume: 1 })); return fixtureBars }
function event(index = 1): MarketEvent { return { id: `event-${index}`, timestamp: fixtureBars[index].timestamp, barIndex: index, assetSymbol: 'TEST', conditionsMatched: ['test'], values: {} } }
const fixed: TradeSimulationConfig = { direction: 'long', entryRule: 'next_bar_open', stop: { type: 'fixed_percent', percent: .01 }, target: { type: 'r_multiple', multiple: 2 }, maxHoldingBars: 3, collisionPolicy: 'stop_first' }
function simulate(values: Array<[number, number?, number?, number?]>, config = fixed) { const source = bars(values); return simulateTrade(source, event(), 'TEST', '1m', config)! }

describe('deterministic historical trade simulator', () => {
  it('exits a long at its target', () => { const trade = simulate([[100], [100], [100, 102.5, 99.5, 101]]); expect(trade.outcome).toBe('target'); expect(trade.exitPrice).toBeCloseTo(102); expect(trade.realizedR).toBeCloseTo(2) })
  it('exits a long at its stop', () => { const trade = simulate([[100], [100], [100, 100.5, 98.5, 99]]); expect(trade.outcome).toBe('stop'); expect(trade.exitPrice).toBeCloseTo(99); expect(trade.realizedR).toBeCloseTo(-1) })
  it('exits a short at its target', () => { const trade = simulate([[100], [100], [100, 100.5, 97.5, 98]], { ...fixed, direction: 'short' }); expect(trade.outcome).toBe('target'); expect(trade.exitPrice).toBeCloseTo(98); expect(trade.realizedR).toBeCloseTo(2) })
  it('exits a short at its stop', () => { const trade = simulate([[100], [100], [100, 101.5, 99.5, 101]], { ...fixed, direction: 'short' }); expect(trade.outcome).toBe('stop'); expect(trade.exitPrice).toBeCloseTo(101); expect(trade.realizedR).toBeCloseTo(-1) })
  it('closes at the configured holding-period timeout', () => { const trade = simulate([[100], [100], [100, 100.5, 99.5, 100.2], [100.3], [100.4]], { ...fixed, maxHoldingBars: 2 }); expect(trade.outcome).toBe('timeout'); expect(trade.exitIndex).toBe(4); expect(trade.exitPrice).toBeCloseTo(100.4) })
  it('uses end_of_data when the maximum hold is beyond loaded history', () => { const trade = simulate([[100], [100], [100, 100.5, 99.5, 100.2]], { ...fixed, maxHoldingBars: 20 }); expect(trade.outcome).toBe('end_of_data'); expect(trade.exitIndex).toBe(2) })
  it('uses ATR known at the signal bar for a stop', () => { const source = bars([[100, 101, 99], [100, 102, 98], [100, 100.5, 99.5]]); const trade = simulateTrade(source, event(), 'TEST', '1m', { ...fixed, stop: { type: 'atr', period: 2, multiplier: 1 } })!; expect(trade.riskPoints).toBeCloseTo(3); expect(trade.stopPrice).toBeCloseTo(97) })
  it('derives an R-multiple target from the risk distance', () => { const trade = simulate([[100], [100], [100, 100.5, 99.5]], { ...fixed, target: { type: 'r_multiple', multiple: 3 } }); expect(trade.targetPrice).toBeCloseTo(103); expect(trade.riskRewardRatio).toBeCloseTo(3) })
  it('uses next-bar open rather than the event close by default', () => { const trade = simulate([[100], [105], [110, 110.5, 109.5]], { ...fixed, maxHoldingBars: 1 }); expect(trade.entryIndex).toBe(2); expect(trade.entryPrice).toBe(110) })
  it('handles stop/target collision conservatively by default', () => { const trade = simulate([[100], [100], [100, 103, 98, 100]]); expect(trade.outcome).toBe('stop'); expect(trade.realizedR).toBeCloseTo(-1) })
  it('supports target-first and ambiguous collision policies explicitly', () => { const targetFirst = simulate([[100], [100], [100, 103, 98, 100]], { ...fixed, collisionPolicy: 'target_first' }); const ambiguous = simulate([[100], [100], [100, 103, 98, 100]], { ...fixed, collisionPolicy: 'ambiguous' }); expect(targetFirst.outcome).toBe('target'); expect(ambiguous.outcome).toBe('ambiguous'); expect(tradeStudyStatistics([ambiguous]).includedTrades).toBe(0) })
  it('does not use later bars to set an ATR stop', () => { const source = bars([[100, 101, 99], [100, 102, 98], [100, 100.5, 99.5], [100, 150, 50]]); const trade = simulateTrade(source, event(), 'TEST', '1m', { ...fixed, stop: { type: 'atr', period: 2, multiplier: 1 }, maxHoldingBars: 1 })!; expect(trade.riskPoints).toBeCloseTo(3) })
})
