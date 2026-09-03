import { parseContinuousFutures } from './parser'
import type { DatasetSource, MarketDataset } from './types'
import type { ParsedMarketData } from './parser'

const defaultWindowBytes = 2_500_000
let parserWorker: Worker | null = null
let parserRequestId = 0
const parserPending = new Map<number, { resolve: (parsed: ParsedMarketData) => void; reject: (error: Error) => void }>()

/** CSV parsing is CPU-heavy on low-power tablets, so the browser path keeps it outside the UI thread. */
function parseDatasetInBackground(text: string): Promise<ParsedMarketData> {
  if (typeof Worker === 'undefined') return Promise.resolve(parseContinuousFutures(text))
  if (!parserWorker) {
    parserWorker = new Worker(new URL('./parserWorker.ts', import.meta.url), { type: 'module' })
    parserWorker.onmessage = (event: MessageEvent<{ id: number; parsed?: ParsedMarketData; error?: string }>) => {
      const pending = parserPending.get(event.data.id)
      if (!pending) return
      parserPending.delete(event.data.id)
      if (event.data.error) pending.reject(new Error(event.data.error))
      else pending.resolve(event.data.parsed as ParsedMarketData)
    }
    parserWorker.onerror = (event) => {
      const error = new Error(event.message || 'Dataset parser worker failed.')
      parserPending.forEach(({ reject }) => reject(error)); parserPending.clear()
      parserWorker?.terminate(); parserWorker = null
    }
  }
  return new Promise<ParsedMarketData>((resolve, reject) => {
    const id = ++parserRequestId
    parserPending.set(id, { resolve, reject })
    parserWorker!.postMessage({ id, text })
  })
}

/** Loads deployable real demo bars from Vite's public directory using browser-safe relative paths. */
export async function loadDataset(source: DatasetSource, windowBytes = defaultWindowBytes): Promise<MarketDataset> {
  const url = `/data/${encodeURIComponent(source.filename)}`
  const head = await fetch(url, { method: 'HEAD' })
  if (!head.ok) throw new Error(`Unable to access ${source.filename} (${head.status}).`)
  const size = Number(head.headers.get('content-length')); const start = Number.isFinite(size) && size > windowBytes ? size - windowBytes : 0
  const response = await fetch(url, { headers: start ? { Range: `bytes=${start}-` } : undefined })
  if (!response.ok && response.status !== 206) throw new Error(`Unable to load ${source.filename} (${response.status}).`)
  let text = await response.text(); if (start) text = text.slice(text.indexOf('\n') + 1)
  const parsed = await parseDatasetInBackground(text); const bars = parsed.bars
  return {
    id: source.id, label: source.label, timeframe: source.timeframe, bars, validation: parsed.validation, isPartial: start > 0, loadedAt: new Date().toISOString(),
    asset: { id: source.id, symbol: source.symbol, displayName: source.label, assetClass: source.assetClass, timeframe: source.timeframe, timezone: source.timezone, source: source.filename, barCount: source.auditedBarCount, startDate: bars[0]?.timestamp, endDate: bars.at(-1)?.timestamp, hasVolume: source.hasVolume },
  }
}
