import type { WebMcpRegistrationStatus } from '../../webmcp/registerTools'
interface TerminalHeaderProps { webMcpStatus: WebMcpRegistrationStatus; toolCount: number; activeAsset: string | null; timeframe: string; onOpenGuide: () => void; onTryDemo: () => void }

export function TerminalHeader({ webMcpStatus, toolCount, activeAsset, timeframe, onOpenGuide, onTryDemo }: TerminalHeaderProps) {
  const statusCopy = webMcpStatus === 'registered' ? ['Ready', `${toolCount} tools`, 'Agent actions available']
    : webMcpStatus === 'registering' ? ['Registering', 'Checking tools', 'One moment']
      : webMcpStatus === 'available' ? ['Available', 'Preparing tools', 'One moment']
        : webMcpStatus === 'error' ? ['Error', 'Tools unavailable', 'Try a compatible browser']
          : ['Unavailable', 'Compatible browser required', 'Open in ChatGPT']

  return (
    <header className="terminal-header">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">Q</div>
        <div className="brand-copy">
          <div className="brand-name">QuantMCP</div>
          <p>Agent-Native Quantitative Research Terminal</p>
        </div>
      </div>
      <div className="header-meta">
        {activeAsset && <span className="environment-label">{activeAsset} · {timeframe}</span>}
        <span className={`status-badge status-${webMcpStatus}`} aria-live="polite"><i /><span><b>{statusCopy[0]}</b><small>{statusCopy[1]} · {statusCopy[2]}</small></span></span>
        <button className="header-button" onClick={onOpenGuide}>Guide</button>
        <button className="header-button primary-header-button" onClick={onTryDemo}>Try Agent Demo</button>
      </div>
    </header>
  )
}
