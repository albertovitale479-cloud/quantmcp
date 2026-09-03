import type { AgentActivityEntry } from '../../data/types'
export function AgentActivityPanel({ entries }: { entries: AgentActivityEntry[] }) {
  const latest = [...entries].reverse()
  const active = latest.some((entry) => entry.status === 'running' || entry.status === 'queued')
  return (
    <aside className="agent-panel panel" aria-label="Agent activity">
      <div className="panel-heading">
        <span>Agent Activity</span>
        <span className="idle-tag">{active ? 'WORKING' : 'IDLE'}</span>
      </div>
      <div className="agent-context"><div><strong>Shared human-agent workspace</strong><p>External WebMCP calls appear here as they update this research session.</p></div></div>
      {!latest.length ? <div className="activity-empty"><span className="activity-line" /><p>Waiting for agent activity</p><small>WebMCP tool calls will appear here as the agent operates this shared workspace.</small></div> : <ol className="activity-list">{latest.map((entry) => <li key={entry.id} className={`activity-entry ${entry.status}`}><span aria-hidden="true">{entry.status === 'success' ? '✓' : entry.status === 'error' ? '×' : '•'}</span><div><strong>{entry.tool}</strong><p>{entry.summary}</p><small>{new Date(entry.timestamp).toLocaleTimeString()}</small></div></li>)}</ol>}
      <div className="agent-legend"><span><i className="legend-dot success" /> Complete</span><span><i className="legend-dot pending" /> Pending</span></div>
    </aside>
  )
}
