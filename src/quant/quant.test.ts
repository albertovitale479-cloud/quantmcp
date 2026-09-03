import { describe, expect, it } from 'vitest'
import type { OHLCVBar } from '../data/types'
import { atr, ema, rsi, sma } from './indicators'
import { calculateForwardReturns } from './eventStudy'
import { scanMarketConditions } from './marketScanner'
import { calculateStatistics } from './statistics'
import { parseContinuousFutures } from '../data/parser'
const bars = (closes: number[]): OHLCVBar[] => closes.map((close, index) => ({ timestamp: 1_700_000_000_000 + index * 60_000, open: close, high: close + 1, low: close - 1, close, volume: 1 }))
describe('deterministic quant engine', () => {
  it('calculates SMA and EMA with documented initialization', () => { const data = bars([1, 2, 3, 4, 5]); expect(sma(data, 3)).toEqual([NaN, NaN, 2, 3, 4]); expect(ema(data, 3)[2]).toBe(2); expect(ema(data, 3)[3]).toBe(3) })
  it('uses Wilder RSI and ATR', () => { expect(rsi(bars([1, 2, 3, 4]), 2)[2]).toBe(100); expect(atr(bars([10, 12, 11]), 2)[1]).toBe(2.5) })
  it('calculates returns and maximum drawdown', () => { const stats = calculateStatistics(bars([100, 120, 90, 110])); expect(stats.cumulativeReturn).toBeCloseTo(.1); expect(stats.maxDrawdown).toBeCloseTo(-.25) })
  it('does not use future bars in condition detection', () => { const data = bars([10, 10, 10, 20]); const events = scanMarketConditions(data, 'TEST', [{ kind: 'sma', period: 3, comparator: 'above' }]); expect(events.map((event) => event.barIndex)).toEqual([3]) })
  it('excludes horizons without an available future close', () => { const data = bars([100, 110, 121]); const events = [{ id: 'event', timestamp: data[1].timestamp, barIndex: 1, assetSymbol: 'TEST', conditionsMatched: [], values: {} }]; const [result] = calculateForwardReturns(data, events, [1, 2]); expect(result.sampleSize).toBe(1); expect(result.mean).toBeCloseTo(.1); expect(calculateForwardReturns(data, events, [2])[0].sampleSize).toBe(0) })
  it('rejects malformed data rows without rejecting valid neighbors', () => { const parsed = parseContinuousFutures('20240102 093100;10;11;9;10.5;2\nbad;line\n20240102 093200;10.5;12;10;11;3'); expect(parsed.bars).toHaveLength(2); expect(parsed.validation.rejectedRows).toBe(1) })
})
