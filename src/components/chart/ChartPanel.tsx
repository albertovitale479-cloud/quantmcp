import { useEffect, useMemo, useRef } from 'react'
import { CandlestickSeries, ColorType, createChart, createSeriesMarkers, type UTCTimestamp } from 'lightweight-charts'
import type { ChartAnnotation, ChartRange, MarketDataset, MarketEvent, SupportedTimeframe } from '../../data/types'

const maximumEventMarkers = 100
/** Even chronological sampling keeps the visual layer deterministic and bounded. */
export function markersForChart(events: MarketEvent[], selectedEventId: string | null): MarketEvent[] {
  if (events.length <= maximumEventMarkers) return events
  const selected = events.find((event) => event.id === selectedEventId)
  const sampled: MarketEvent[] = []
  const target = maximumEventMarkers - (selected ? 1 : 0)
  for (let index = 0; index < target; index += 1) sampled.push(events[Math.floor(index * events.length / target)])
  if (selected && !sampled.some((event) => event.id === selected.id)) sampled.push(selected)
  return sampled.sort((left, right) => left.timestamp - right.timestamp)
}

interface ChartPanelProps {
  dataset: MarketDataset | null; events: MarketEvent[]; annotations: ChartAnnotation[]; visibleRange: ChartRange | null; selectedEventId: string | null
  timeframes: SupportedTimeframe[]; onSetTimeframe: (timeframe: SupportedTimeframe) => void; onSelectEvent: (id: string | null) => void
}
export function ChartPanel({ dataset, events, annotations, visibleRange, selectedEventId, timeframes, onSetTimeframe, onSelectEvent }: ChartPanelProps) {
  const elementRef = useRef<HTMLDivElement>(null)
  const shownEvents = useMemo(() => markersForChart(events, selectedEventId), [events, selectedEventId])
  useEffect(() => {
    const element = elementRef.current
    if (!element || !dataset?.bars.length) return
    const chart = createChart(element, { width: element.clientWidth, height: element.clientHeight, layout: { background: { type: ColorType.Solid, color: '#101b29' }, textColor: '#91a4b9', fontFamily: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace' }, grid: { vertLines: { color: '#1b2a3b' }, horzLines: { color: '#1b2a3b' } }, rightPriceScale: { borderColor: '#293c50' }, timeScale: { borderColor: '#293c50', timeVisible: true, secondsVisible: false }, crosshair: { vertLine: { color: '#5d7893' }, horzLine: { color: '#5d7893' } } })
    const series = chart.addSeries(CandlestickSeries, { upColor: '#38a879', downColor: '#d3636f', borderVisible: false, wickUpColor: '#38a879', wickDownColor: '#d3636f' })
    series.setData(dataset.bars.map((bar) => ({ time: Math.floor(bar.timestamp / 1000) as UTCTimestamp, open: bar.open, high: bar.high, low: bar.low, close: bar.close })))
    const markers = createSeriesMarkers(series, [
      ...shownEvents.map((event) => ({ time: Math.floor(event.timestamp / 1000) as UTCTimestamp, position: 'belowBar' as const, color: event.id === selectedEventId ? '#f3a55f' : '#5b9ad7', shape: 'arrowUp' as const, text: 'E', id: event.id })),
      ...annotations.map((annotation) => ({ time: Math.floor(annotation.timestamp / 1000) as UTCTimestamp, position: 'aboveBar' as const, color: '#b98be8', shape: 'circle' as const, text: annotation.label.slice(0, 24), id: `annotation:${annotation.id}` })),
    ])
    const observer = new ResizeObserver(([entry]) => chart.resize(entry.contentRect.width, entry.contentRect.height))
    observer.observe(element)
    if (visibleRange) chart.timeScale().setVisibleRange({ from: Math.floor(visibleRange.from / 1000) as UTCTimestamp, to: Math.floor(visibleRange.to / 1000) as UTCTimestamp })
    else chart.timeScale().fitContent()
    chart.subscribeClick((parameter) => { const marker = parameter.hoveredInfo?.objectId; onSelectEvent(typeof marker === 'string' && !marker.startsWith('annotation:') ? marker : null) })
    return () => { observer.disconnect(); markers.detach(); chart.remove() }
  }, [dataset, shownEvents, annotations, visibleRange, selectedEventId, onSelectEvent])
  return <section className="chart-panel panel" aria-label="Market chart">
    <div className="panel-toolbar"><div><div className="eyebrow">Market chart</div><h1>{dataset ? `${dataset.asset.symbol} · ${dataset.timeframe}` : 'Chart workspace'}</h1></div>
      <div className="chart-controls" aria-label="Timeframe selector">{timeframes.map((timeframe) => <button key={timeframe} className={dataset?.timeframe === timeframe ? 'timeframe-button active' : 'timeframe-button'} onClick={() => onSetTimeframe(timeframe)} disabled={!dataset} aria-pressed={dataset?.timeframe === timeframe}>{timeframe}</button>)}</div>
    </div>
    <div className="chart-canvas" ref={elementRef}>{!dataset && <div className="chart-empty-state"><strong>Load a market dataset</strong><p>Choose a continuous futures series from the dataset selector.</p></div>}</div>
    <footer className="chart-footer"><span>{dataset ? `${dataset.asset.timezone} · ${dataset.bars.length.toLocaleString()} ${dataset.timeframe} bars` : 'OHLCV · NO ACTIVE DATASET'}</span><span>{events.length ? `${events.length} EVENTS · ${shownEvents.length} SHOWN` : 'NO ACTIVE SCAN'}</span></footer>
  </section>
}
