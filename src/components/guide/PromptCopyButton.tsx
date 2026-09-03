import { useState } from 'react'

export function PromptCopyButton({ prompt, compact = false }: { prompt: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch { /* Clipboard access can be unavailable in non-secure local previews. */ }
  }
  return <button className={compact ? 'copy-button compact' : 'copy-button'} onClick={() => void copy()} aria-label="Copy demo prompt">{copied ? 'Copied' : 'Copy prompt'}</button>
}
