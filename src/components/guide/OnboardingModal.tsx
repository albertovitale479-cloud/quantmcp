import { useEffect, useState } from 'react'
import { demoPrompts } from '../../content/demoPrompts'
import { PromptCopyButton } from './PromptCopyButton'

interface OnboardingModalProps { onDismiss: () => void; onOpenGuide: () => void }
const steps = [
  { title: 'Explore markets visually', body: 'Select a futures market, change the timeframe, and inspect the chart and deterministic metrics.' },
  { title: 'Connect an agent through WebMCP', body: 'Open QuantMCP inside a compatible ChatGPT browser. The agent can discover this page’s tools directly—no separate MCP server configuration.' },
  { title: 'Run your first research workflow', body: 'Copy these prompts into ChatGPT to scan the real loaded data, study forward returns, and focus an historical case.' },
]

export function OnboardingModal({ onDismiss, onOpenGuide }: OnboardingModalProps) {
  const [step, setStep] = useState(0)
  useEffect(() => { const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onDismiss(); if (event.key === 'ArrowRight') setStep((current) => Math.min(current + 1, steps.length - 1)); if (event.key === 'ArrowLeft') setStep((current) => Math.max(current - 1, 0)) }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler) }, [onDismiss])
  const last = step === steps.length - 1
  return <div className="modal-backdrop onboarding-backdrop" role="presentation"><section className="onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="onboarding-title"><div className="onboarding-top"><span>GET STARTED · {String(step + 1).padStart(2, '0')} / 03</span><button className="skip-button" onClick={onDismiss}>Skip for now</button></div><div className="onboarding-body"><p className="eyebrow">QuantMCP</p><h2 id="onboarding-title">{steps[step].title}</h2><p>{steps[step].body}</p>{last && <div className="onboarding-prompts">{demoPrompts.slice(1).map((item) => <div key={item.id}><p>{item.prompt}</p><PromptCopyButton prompt={item.prompt} compact /></div>)}</div>}</div><div className="onboarding-actions"><div className="step-dots" aria-label={`Step ${step + 1} of 3`}>{steps.map((item, index) => <i key={item.title} className={index === step ? 'active' : ''} />)}</div><div>{step > 0 && <button className="secondary-button" onClick={() => setStep(step - 1)}>Back</button>}{last ? <><button className="secondary-button" onClick={() => { onDismiss(); onOpenGuide() }}>Open full guide</button><button className="primary-button" onClick={onDismiss}>Start exploring</button></> : <button className="primary-button" onClick={() => setStep(step + 1)}>Continue</button>}</div></div></section></div>
}
