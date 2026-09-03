# Hackathon demo plan

## Judge-first story

1. Open QuantMCP. The short first-run guide explains that the human visually inspects markets while a compatible ChatGPT agent can operate the same workspace through WebMCP.
2. Show the header’s real WebMCP registration state. If it is ready, it also displays the actual registered tool count; if not, it explains how to open the app in a compatible ChatGPT browser.
3. Select **Try Agent Demo**. It prepares the real NQ 15m human workspace, clears old research, focuses the chart, and opens the guide. It does not make a fake agent call or compute hidden results.
4. Copy these prompts into ChatGPT in order:

   1. “Use QuantMCP's WebMCP tools to tell me the current active asset and timeframe.”
   2. “On NQ 15m, find historical periods where price was above SMA(200), RSI(14) was below 35, and volatility was above its 80th percentile. Show the matching events in the workspace.”
   3. “Analyze the 1, 5, 10 and 20 bar forward returns for those events.”
   4. “Show me one of the worst historical cases, focus the chart on it, and annotate the event with a concise research note.”

5. Show the shared result: the chart markers, Research Study conditions and computed forward returns, plus Agent Activity’s real tool calls and timestamps.

## Demo guardrails

- Label all datasets with their source and timeframe.
- Use computed values from the quant layer rather than model-generated numbers.
- Show tool activity and changes to shared workspace state.
- Do not claim an agent is connected until it has made a real WebMCP call.
- Do not hardcode event counts, returns, dates, or findings; all displayed research comes from the loaded demo data.
- State clearly that QuantMCP is a research environment, not execution or financial advice.
