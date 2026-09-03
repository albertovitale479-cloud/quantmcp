import type { ForwardReturnSummary } from '../../quant/eventStudy'
import type { MarketEvent } from '../../data/types'

interface Props { events: MarketEvent[]; selectedEventId: string | null; results: ForwardReturnSummary[]; conditions: string[]; onRun: () => void; onSelect: (id: string | null) => void; disabled: boolean }
export function ResearchPanel({ events, selectedEventId, results, conditions, onRun, onSelect, disabled }: Props) {
  const selectedIndex = Math.max(0, events.findIndex((event) => event.id === selectedEventId))
  const selectOffset = (offset: number) => { if (events.length) onSelect(events[(selectedIndex + offset + events.length) % events.length].id) }
  return <section className="research-panel panel" aria-label="Research study">
    <div className="panel-heading"><span>Research study</span><button className="text-button enabled" onClick={onRun} disabled={disabled}>Run sample study</button></div>
    {!events.length ? <div className="research-empty"><span className="research-index">01</span><div><strong>Structured historical research</strong><p>Run a no-lookahead condition scan on the active timeframe. Matching events feed an independent forward-return study.</p></div></div> : <div className="study-results">
      <div className="condition-list" aria-label="Study conditions">{conditions.map((condition) => <span key={condition}>{condition}</span>)}</div>
      <div className="study-summary"><strong>{events.length.toLocaleString()} historical events</strong><span>{events.length > 100 ? 'All events used statistically; 100 shown on chart.' : 'All events shown on chart.'}</span></div>
      <div className="event-navigation"><button onClick={() => selectOffset(-1)} disabled={!events.length}>Previous event</button><span>{selectedEventId ? `Event ${selectedIndex + 1} of ${events.length}` : 'Select an event'}</span><button onClick={() => selectOffset(1)} disabled={!events.length}>Next event</button></div>
      <div className="horizon-grid">{results.map((result) => <button key={result.horizon} className="horizon-card" onClick={() => onSelect(events[selectedIndex]?.id ?? events[0].id)}><span>+{result.horizon} bars</span><strong>{Number.isFinite(result.mean) ? `${(result.mean * 100).toFixed(2)}%` : '—'}</strong><small>n={result.sampleSize} · win {Number.isFinite(result.winRate) ? `${(result.winRate * 100).toFixed(0)}%` : '—'}</small></button>)}</div>
    </div>}
  </section>
}
