import { registeredWebMcpToolNames, type WebMcpRegistrationStatus } from '../../webmcp/registerTools'
interface TerminalHeaderProps { webMcpStatus: WebMcpRegistrationStatus; activeAsset: string | null; timeframe: string }

export function TerminalHeader({ webMcpStatus, activeAsset, timeframe }: TerminalHeaderProps) {
  const label = webMcpStatus === 'registered' ? 'Ready' : webMcpStatus === 'registering' ? 'Registering' : webMcpStatus === 'available' ? 'Available' : webMcpStatus === 'error' ? 'Error' : 'Unavailable'

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
        <span className={`status-badge status-${webMcpStatus}`} aria-live="polite"><i /> WEBMCP · {label}{webMcpStatus === 'registered' && ` · ${registeredWebMcpToolNames.length} TOOLS`}</span>
      </div>
    </header>
  )
}
