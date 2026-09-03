# Release smoke test

Use this checklist after deploying the public HTTPS URL. It validates the deployable demo, not the full local research corpus.

## Application

- [ ] App opens without a blank screen or console error.
- [ ] Main NQ chart renders with real bars.
- [ ] Asset switching works for all eight symbols.
- [ ] Timeframe switches work for 1m, 5m, 15m, 30m, and 1h.

## Quant research

- [ ] Metrics render after a dataset loads.
- [ ] A structured condition scan returns a valid event count.
- [ ] Forward returns render for requested horizons.
- [ ] Previous/next event navigation focuses the chart.
- [ ] Annotations render on the active timeframe.
- [ ] If more than 100 events exist, the UI distinguishes total statistical events from markers shown.

## WebMCP

- [ ] Unsupported browsers show WebMCP as unavailable while human research still works.
- [ ] A compatible browser shows `WEBMCP · Ready · 13 Tools`.
- [ ] `get_workspace_state` returns the current shared state.
- [ ] `set_active_asset` and `set_timeframe` update the visible workspace.
- [ ] `query_market_conditions` and `calculate_forward_returns` update the study.
- [ ] `focus_chart_range` and `annotate_chart` update the chart.
- [ ] Agent Activity records tool calls and outcomes.

## Release checks

- [ ] `npm ci` completes from a fresh clone.
- [ ] `npm test` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` produces `dist/`.
- [ ] `dist/data/` contains the eight real curated demo files.
- [ ] No secrets, local absolute paths, or full local source corpus files are committed.
- [ ] MIT license and README are present.

## Git and Vercel

```bash
git init
git add .
git status
git commit -m "Prepare QuantMCP WebMCP Challenge release"
git branch -M main
git remote add origin <YOUR_GITHUB_REPOSITORY_URL>
git push -u origin main
```

In Vercel, import the GitHub repository and use **Vite**, `npm ci`, `npm run build`, and `dist`. No environment variables, rewrites, or serverless functions are needed.
