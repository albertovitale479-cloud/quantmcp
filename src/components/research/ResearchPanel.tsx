import type { ForwardReturnSummary } from '../../quant/eventStudy'
import type { MarketDataset, MarketEvent } from '../../data/types'

interface Props { dataset: MarketDataset | null; events: MarketEvent[]; markerCount: number; selectedEventId: string | null; results: ForwardReturnSummary[]; conditions: string[]; onRun: () => void; onSelect: (id: string | null) => void; disabled: boolean }
const formatPeriod = (timestamp?: number) => timestamp ? new Date(timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'
export function ResearchPanel({ dataset, events, markerCount, selectedEventId, results, conditions, onRun, onSelect, disabled }: Props) {
  const selectedIndex = Math.max(0, events.findIndex((event) => event.id === selectedEventId))
  const selectOffset = (offset: number) => { if (events.length) onSelect(events[(selectedIndex + offset + events.length) % events.length].id) }
  return <section className="research-panel panel" aria-label="Research study">
    <div className="panel-heading"><span>Research study</span><button className="text-button enabled" onClick={onRun} disabled={disabled}>Run quick study</button></div>
    <div className="research-context"><strong>{dataset ? `${dataset.asset.symbol} · ${dataset.timeframe}` : 'No active market'}</strong><span>{dataset ? `${formatPeriod(dataset.asset.startDate)} – ${formatPeriod(dataset.asset.endDate)}` : 'Load a market to begin'}</span></div>
    {!events.length ? <div className="research-empty"><span className="research-index">01</span><div><strong>Structured historical research</strong><p>Run a no-lookahead scan on the active timeframe. Matching events feed an independent forward-return study.</p><small>Conditions · no active scan &nbsp; / &nbsp; Markers · 0 shown</small></div></div> : <div className="study-results">
      <div className="condition-list" aria-label="Study conditions">{conditions.map((condition) => <span key={condition}>{condition}</span>)}</div>
      <div className="study-summary"><strong>{events.length.toLocaleString()} historical events</strong><span>{markerCount.toLocaleString()} chart markers shown · all events used statistically</span></div>
      <div className="event-navigation"><button onClick={() => selectOffset(-1)} disabled={!events.length}>Previous event</button><span>{selectedEventId ? `Event ${selectedIndex + 1} of ${events.length}` : 'Select an event'}</span><button onClick={() => selectOffset(1)} disabled={!events.length}>Next event</button></div>
      {results.length ? <><p className="forward-label">Forward returns</p><div className="horizon-grid">{results.map((result) => <button key={result.horizon} className="horizon-card" onClick={() => onSelect(events[selectedIndex]?.id ?? events[0].id)}><span>+{result.horizon} bars</span><strong>{Number.isFinite(result.mean) ? `${(result.mean * 100).toFixed(2)}%` : '—'}</strong><small>n={result.sampleSize} · win {Number.isFinite(result.winRate) ? `${(result.winRate * 100).toFixed(0)}%` : '—'}</small></button>)}</div></> : <p className="forward-label empty">Forward returns pending — ask the agent or run the study.</p>}
    </div>}
  </section>
}
