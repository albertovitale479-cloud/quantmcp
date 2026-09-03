import { useEffect, useMemo, useRef } from 'react'
import { CandlestickSeries, ColorType, createChart, createSeriesMarkers, type UTCTimestamp } from 'lightweight-charts'
import type { ChartAnnotation, ChartRange, MarketDataset, MarketEvent, SupportedTimeframe } from '../../data/types'
import type { HistoricalTrade } from '../../quant/tradeSimulator'

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
function markersForTrades(trades: HistoricalTrade[], selectedTradeId: string | null) {
  if (trades.length <= maximumEventMarkers) return trades
  const selected = trades.find((trade) => trade.id === selectedTradeId); const output: HistoricalTrade[] = []; const target = maximumEventMarkers - (selected ? 1 : 0)
  for (let index = 0; index < target; index += 1) output.push(trades[Math.floor(index * trades.length / target)])
  if (selected && !output.some((trade) => trade.id === selected.id)) output.push(selected)
  return output.sort((left, right) => left.entryTimestamp - right.entryTimestamp)
}

interface ChartPanelProps {
  dataset: MarketDataset | null; events: MarketEvent[]; annotations: ChartAnnotation[]; visibleRange: ChartRange | null; selectedEventId: string | null; trades: HistoricalTrade[]; selectedTradeId: string | null
  timeframes: SupportedTimeframe[]; onSetTimeframe: (timeframe: SupportedTimeframe) => void; onSelectEvent: (id: string | null) => void; onSelectTrade: (id: string) => void
}
export function ChartPanel({ dataset, events, annotations, visibleRange, selectedEventId, trades, selectedTradeId, timeframes, onSetTimeframe, onSelectEvent, onSelectTrade }: ChartPanelProps) {
  const elementRef = useRef<HTMLDivElement>(null)
  const shownEvents = useMemo(() => markersForChart(events, selectedEventId), [events, selectedEventId])
  const shownTrades = useMemo(() => markersForTrades(trades, selectedTradeId), [trades, selectedTradeId])
  useEffect(() => {
    const element = elementRef.current
    if (!element || !dataset?.bars.length) return
    const chart = createChart(element, { width: element.clientWidth, height: element.clientHeight, layout: { background: { type: ColorType.Solid, color: '#101b29' }, textColor: '#91a4b9', fontFamily: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace' }, grid: { vertLines: { color: '#1b2a3b' }, horzLines: { color: '#1b2a3b' } }, rightPriceScale: { borderColor: '#293c50' }, timeScale: { borderColor: '#293c50', timeVisible: true, secondsVisible: false }, crosshair: { vertLine: { color: '#5d7893' }, horzLine: { color: '#5d7893' } } })
    const series = chart.addSeries(CandlestickSeries, { upColor: '#38a879', downColor: '#d3636f', borderVisible: false, wickUpColor: '#38a879', wickDownColor: '#d3636f' })
    series.setData(dataset.bars.map((bar) => ({ time: Math.floor(bar.timestamp / 1000) as UTCTimestamp, open: bar.open, high: bar.high, low: bar.low, close: bar.close })))
    const markers = createSeriesMarkers(series, [
      ...shownEvents.map((event) => ({ time: Math.floor(event.timestamp / 1000) as UTCTimestamp, position: 'belowBar' as const, color: event.id === selectedEventId ? '#f3a55f' : '#5b9ad7', shape: 'arrowUp' as const, text: 'E', id: event.id })),
      ...annotations.map((annotation) => ({ time: Math.floor(annotation.timestamp / 1000) as UTCTimestamp, position: 'aboveBar' as const, color: '#b98be8', shape: 'circle' as const, text: annotation.label.slice(0, 24), id: `annotation:${annotation.id}` })),
      ...shownTrades.flatMap((trade) => [
        { time: Math.floor(trade.entryTimestamp / 1000) as UTCTimestamp, position: trade.direction === 'long' ? 'belowBar' as const : 'aboveBar' as const, color: trade.direction === 'long' ? '#5cbf8c' : '#e07680', shape: trade.direction === 'long' ? 'arrowUp' as const : 'arrowDown' as const, text: trade.id === selectedTradeId ? 'TRADE' : trade.direction === 'long' ? 'L' : 'S', id: `trade:${trade.id}` },
        { time: Math.floor(trade.exitTimestamp / 1000) as UTCTimestamp, position: 'aboveBar' as const, color: trade.outcome === 'target' ? '#63bd89' : trade.outcome === 'stop' ? '#e07680' : '#d4a85d', shape: 'circle' as const, text: trade.outcome === 'target' ? '✓' : trade.outcome === 'stop' ? '×' : '•', id: `trade-exit:${trade.id}` },
      ]),
    ])
    const selectedTrade = trades.find((trade) => trade.id === selectedTradeId)
    const priceLines = selectedTrade ? [
      series.createPriceLine({ price: selectedTrade.entryPrice, color: '#8ab9e8', lineWidth: 2, lineStyle: 0, axisLabelVisible: true, title: `ENTRY ${selectedTrade.entryPrice.toFixed(4)}` }),
      series.createPriceLine({ price: selectedTrade.stopPrice, color: '#d96872', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: `STOP ${selectedTrade.stopPrice.toFixed(4)}` }),
      series.createPriceLine({ price: selectedTrade.targetPrice, color: '#58b981', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: `TARGET ${selectedTrade.targetPrice.toFixed(4)}` }),
    ] : []
    let overlay: HTMLDivElement | null = null
    const drawTradeOverlay = () => {
      overlay?.remove(); overlay = null
      if (!selectedTrade) return
      const left = chart.timeScale().timeToCoordinate(Math.floor(selectedTrade.entryTimestamp / 1000) as UTCTimestamp); const right = chart.timeScale().timeToCoordinate(Math.floor(selectedTrade.exitTimestamp / 1000) as UTCTimestamp)
      const entry = series.priceToCoordinate(selectedTrade.entryPrice); const stop = series.priceToCoordinate(selectedTrade.stopPrice); const target = series.priceToCoordinate(selectedTrade.targetPrice)
      if (left === null || right === null || entry === null || stop === null || target === null) return
      const box = document.createElement('div'); box.className = `trade-risk-overlay ${selectedTrade.direction}`; box.style.left = `${Math.min(left, right)}px`; box.style.width = `${Math.max(4, Math.abs(right - left))}px`; box.style.top = `${Math.min(stop, target)}px`; box.style.height = `${Math.max(4, Math.abs(stop - target))}px`
      const targetArea = document.createElement('div'); targetArea.className = 'trade-target-area'; targetArea.style.top = `${Math.min(entry, target) - Math.min(stop, target)}px`; targetArea.style.height = `${Math.abs(entry - target)}px`
      const stopArea = document.createElement('div'); stopArea.className = 'trade-stop-area'; stopArea.style.top = `${Math.min(entry, stop) - Math.min(stop, target)}px`; stopArea.style.height = `${Math.abs(entry - stop)}px`
      const label = document.createElement('span'); label.className = 'trade-overlay-label'; label.textContent = `${selectedTrade.direction.toUpperCase()} · ${selectedTrade.riskRewardRatio.toFixed(2)}R · ${selectedTrade.outcome.replaceAll('_', ' ')}`
      box.append(targetArea, stopArea, label); element.appendChild(box); overlay = box
    }
    const observer = new ResizeObserver(([entry]) => { chart.resize(entry.contentRect.width, entry.contentRect.height); drawTradeOverlay() })
    observer.observe(element)
    if (visibleRange) chart.timeScale().setVisibleRange({ from: Math.floor(visibleRange.from / 1000) as UTCTimestamp, to: Math.floor(visibleRange.to / 1000) as UTCTimestamp })
    else chart.timeScale().fitContent()
    drawTradeOverlay()
    chart.timeScale().subscribeVisibleTimeRangeChange(drawTradeOverlay)
    chart.subscribeClick((parameter) => { const marker = parameter.hoveredInfo?.objectId; if (typeof marker === 'string' && marker.startsWith('trade:')) onSelectTrade(marker.slice(6)); else if (typeof marker === 'string' && marker.startsWith('trade-exit:')) onSelectTrade(marker.slice(10)); else onSelectEvent(typeof marker === 'string' && !marker.startsWith('annotation:') ? marker : null) })
    return () => { observer.disconnect(); chart.timeScale().unsubscribeVisibleTimeRangeChange(drawTradeOverlay); overlay?.remove(); priceLines.forEach((line) => series.removePriceLine(line)); markers.detach(); chart.remove() }
  }, [dataset, shownEvents, shownTrades, annotations, visibleRange, selectedEventId, selectedTradeId, trades, onSelectEvent, onSelectTrade])
  return <section className="chart-panel panel" aria-label="Market chart">
    <div className="panel-toolbar"><div><div className="eyebrow">Market chart</div><h1>{dataset ? `${dataset.asset.symbol} · ${dataset.timeframe}` : 'Chart workspace'}</h1></div>
      <div className="chart-controls" aria-label="Timeframe selector">{timeframes.map((timeframe) => <button key={timeframe} className={dataset?.timeframe === timeframe ? 'timeframe-button active' : 'timeframe-button'} onClick={() => onSetTimeframe(timeframe)} disabled={!dataset} aria-pressed={dataset?.timeframe === timeframe}>{timeframe}</button>)}</div>
    </div>
    <div className="chart-canvas" ref={elementRef}>{!dataset && <div className="chart-empty-state"><strong>Load a market dataset</strong><p>Choose a continuous futures series from the dataset selector.</p></div>}</div>
    <footer className="chart-footer"><span>{dataset ? `${dataset.asset.timezone} · ${dataset.bars.length.toLocaleString()} ${dataset.timeframe} bars` : 'OHLCV · NO ACTIVE DATASET'}</span><span>{trades.length ? `${trades.length} TRADES · ${shownTrades.length} MARKED` : events.length ? `${events.length} EVENTS · ${shownEvents.length} SHOWN` : 'NO ACTIVE SCAN'}</span></footer>
  </section>
}
