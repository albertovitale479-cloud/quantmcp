import type { OHLCVBar } from './types'
const centralTime = 'America/Chicago'
function zonedParts(epochMs: number): Record<string, number> {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: centralTime, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(epochMs))
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]))
}
/** Converts a Central Time wall-clock field into UTC milliseconds without relying on the browser locale. */
export function centralTimeToUnix(value: string): number | null {
  const match = /^(\d{4})(\d{2})(\d{2})\s+(\d{2})(\d{2})(\d{2})$/.exec(value.trim())
  if (!match) return null
  const [, year, month, day, hour, minute, second] = match.map(Number)
  const wallClock = Date.UTC(year, month - 1, day, hour, minute, second); let candidate = wallClock
  for (let pass = 0; pass < 2; pass += 1) { const parts = zonedParts(candidate); const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second); candidate = wallClock - (represented - candidate) }
  return Number.isFinite(candidate) ? candidate : null
}
export function normalizeOhlcv(values: { timestamp: string; open: string; high: string; low: string; close: string; volume?: string }): OHLCVBar | null {
  const timestamp = centralTimeToUnix(values.timestamp); const open = Number(values.open); const high = Number(values.high); const low = Number(values.low); const close = Number(values.close); const volume = values.volume === undefined || values.volume === '' ? undefined : Number(values.volume)
  return timestamp === null ? null : { timestamp, open, high, low, close, volume }
}
