import { demoPrompts } from '../../content/demoPrompts'
import type { WebMcpRegistrationStatus } from '../../webmcp/registerTools'
import { PromptCopyButton } from './PromptCopyButton'

interface GuideModalProps { status: WebMcpRegistrationStatus; toolCount: number; onClose: () => void }

export function GuideModal({ status, toolCount, onClose }: GuideModalProps) {
  const ready = status === 'registered'
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-header"><div><p className="eyebrow">Guide</p><h2 id="guide-title">Use QuantMCP with ChatGPT</h2></div><button className="modal-close" onClick={onClose} aria-label="Close guide">×</button></div>
      <div className="guide-intro"><p>Humans inspect the market visually. A compatible ChatGPT agent can use the same workspace through the tools exposed by this page.</p><div className="interaction-flow" aria-label="ChatGPT agent connects through WebMCP to QuantMCP and the human interface"><span>ChatGPT<br />agent</span><b>↓</b><span>WebMCP</span><b>↓</b><span>QuantMCP<br />↕ Human UI</span></div></div>
      <div className={`guide-status ${ready ? 'ready' : 'unavailable'}`}><span>{ready ? 'WebMCP tools detected' : 'WebMCP unavailable in this browser.'}</span><strong>{ready ? `${toolCount} tools` : 'Open in a compatible ChatGPT browser'}</strong><p>{ready ? 'Your agent can use these tools directly from this page.' : 'The human research workspace is still fully available.'}</p></div>
      <div className="capability-grid"><div><strong>Human</strong><span>Visual inspection · asset/timeframe selection · event navigation · interpretation</span></div><div><strong>Agent</strong><span>Structured data · historical scans · event studies · chart focus · annotations</span></div><div><strong>Shared</strong><span>One workspace · one data source · one quant engine · one research context</span></div></div>
      <div className="prompt-section"><div className="panel-heading"><span>Demo prompts</span><span>Copy one into ChatGPT</span></div>{demoPrompts.map((item) => <article className="prompt-row" key={item.id}><div><strong>{item.label}</strong><p>{item.prompt}</p></div><PromptCopyButton prompt={item.prompt} compact /></article>)}</div>
    </section>
  </div>
}
