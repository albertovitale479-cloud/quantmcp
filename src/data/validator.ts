import type { DatasetValidationReport, OHLCVBar } from './types'

export function createValidationReport(): DatasetValidationReport {
  return { totalRows: 0, validRows: 0, rejectedRows: 0, duplicates: 0, missingValues: 0, malformedRows: 0, invalidOhlc: 0, invalidVolume: 0, outOfOrderRows: 0, irregularIntervals: 0, warnings: [] }
}
export function validateBar(bar: OHLCVBar): 'valid' | 'invalid-ohlc' | 'invalid-volume' | 'invalid-timestamp' {
  const { timestamp, open, high, low, close, volume } = bar
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 'invalid-timestamp'
  if (![open, high, low, close].every((value) => Number.isFinite(value) && value > 0) || high < Math.max(open, close, low) || low > Math.min(open, close, high)) return 'invalid-ohlc'
  if (volume !== undefined && (!Number.isFinite(volume) || volume < 0)) return 'invalid-volume'
  return 'valid'
}
