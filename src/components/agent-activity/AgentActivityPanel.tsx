import type { AgentActivityEntry } from '../../data/types'
import type { WebMcpRegistrationStatus } from '../../webmcp/registerTools'
import { demoPrompts } from '../../content/demoPrompts'
import { PromptCopyButton } from '../guide/PromptCopyButton'

export function AgentActivityPanel({ entries, webMcpStatus }: { entries: AgentActivityEntry[]; webMcpStatus: WebMcpRegistrationStatus }) {
  const latest = [...entries].reverse()
  const current = latest[0]
  const active = current?.status === 'running' || current?.status === 'queued'
  const state = active ? ['ACTIVE', 'Agent is using QuantMCP'] : current?.status === 'success' ? ['SUCCESS', 'Last research operation completed'] : current?.status === 'error' ? ['ERROR', 'Tool operation failed'] : webMcpStatus === 'registered' ? ['READY', 'WebMCP tools available'] : ['WAITING', 'No agent actions yet']
  return (
    <aside className="agent-panel panel" aria-label="Agent activity">
      <div className="panel-heading">
        <span>Agent Activity</span>
        <span className={`idle-tag ${state[0].toLowerCase()}`}>{state[0]}</span>
      </div>
      <div className="agent-context"><div><strong>{state[1]}</strong><p>External WebMCP calls update the same chart, study, and research state you see here.</p></div></div>
      {!latest.length ? <div className="activity-empty"><span className="activity-line" /><p>Open QuantMCP in a compatible ChatGPT browser and ask the agent to use this site’s WebMCP tools.</p><small>Example: “{demoPrompts[0].prompt}”</small><PromptCopyButton prompt={demoPrompts[0].prompt} compact /></div> : <ol className="activity-list">{latest.map((entry) => <li key={entry.id} className={`activity-entry ${entry.status}`}><span aria-hidden="true">{entry.status === 'success' ? '✓' : entry.status === 'error' ? '×' : '•'}</span><div><strong>{entry.tool}</strong><p>{entry.summary}</p><small>{new Date(entry.timestamp).toLocaleTimeString()}</small></div></li>)}</ol>}
      <div className="agent-legend"><span><i className="legend-dot success" /> Complete</span><span><i className="legend-dot pending" /> Pending</span></div>
    </aside>
  )
}
