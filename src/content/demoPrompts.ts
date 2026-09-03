export interface DemoPrompt {
  id: 'workspace' | 'research' | 'event-study' | 'collaboration' | 'cross-asset' | 'parameter-search' | 'universe-optimization' | 'universal-settings' | 'trade-simulation' | 'focus-trade'
  label: string
  prompt: string
}

/** Competition-safe prompts only describe workflows; results always come from loaded data. */
export const demoPrompts: DemoPrompt[] = [
  { id: 'workspace', label: 'Workspace', prompt: "Use QuantMCP's WebMCP tools to tell me the current active asset and timeframe." },
  { id: 'research', label: 'Research', prompt: 'On NQ 15m, find historical periods where price was above SMA(200), RSI(14) was below 35, and volatility was above its 80th percentile. Show the matching events in the workspace.' },
  { id: 'event-study', label: 'Event study', prompt: 'Analyze the 1, 5, 10 and 20 bar forward returns for those events.' },
  { id: 'collaboration', label: 'Human + agent', prompt: 'Show me one of the worst historical cases, focus the chart on it, and annotate the event with a concise research note.' },
  { id: 'cross-asset', label: 'Cross-asset research', prompt: 'Use QuantMCP to test this market condition across every available asset on 15m. Rank the markets by out-of-sample robustness and explain the quantitative differences.' },
  { id: 'parameter-search', label: 'Parameter search', prompt: 'For NQ 15m, test a bounded range of RSI, SMA and volatility parameters. Find robust parameter regions using chronological train/test validation rather than the single highest in-sample result.' },
  { id: 'universe-optimization', label: 'Universe optimization', prompt: 'Optimize the supported parameters independently for every available asset and show which markets have the strongest out-of-sample and parameter-stability results.' },
  { id: 'universal-settings', label: 'Universal settings', prompt: 'Find one robust parameter region that generalizes best across the selected asset universe rather than optimizing each asset independently.' },
  { id: 'trade-simulation', label: 'Trade simulation', prompt: 'Use QuantMCP to simulate historical long trades from the current events using next-bar entry, a 1 ATR stop, a 2R target, and a 20-bar maximum hold. Then show me the worst trade.' },
  { id: 'focus-trade', label: 'Focus a trade', prompt: 'Focus the chart on the worst historical trade and show its entry, stop, and target.' },
]

export const recommendedDemoPrompt = demoPrompts[1]
