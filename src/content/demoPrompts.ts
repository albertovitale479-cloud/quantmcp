export interface DemoPrompt {
  id: 'workspace' | 'research' | 'event-study' | 'collaboration'
  label: string
  prompt: string
}

/** Competition-safe prompts only describe workflows; results always come from loaded data. */
export const demoPrompts: DemoPrompt[] = [
  { id: 'workspace', label: 'Workspace', prompt: "Use QuantMCP's WebMCP tools to tell me the current active asset and timeframe." },
  { id: 'research', label: 'Research', prompt: 'On NQ 15m, find historical periods where price was above SMA(200), RSI(14) was below 35, and volatility was above its 80th percentile. Show the matching events in the workspace.' },
  { id: 'event-study', label: 'Event study', prompt: 'Analyze the 1, 5, 10 and 20 bar forward returns for those events.' },
  { id: 'collaboration', label: 'Human + agent', prompt: 'Show me one of the worst historical cases, focus the chart on it, and annotate the event with a concise research note.' },
]

export const recommendedDemoPrompt = demoPrompts[1]
