# QuantMCP

## Agent-Native Quantitative Research Terminal

Human judgment. Agent scale. One shared research workspace.

QuantMCP is a client-side quantitative market-research terminal built for the OpenAI WebMCP Challenge. A human and a compatible external agent inspect the same deterministic workspace: the chart, active market and timeframe, historical condition events, forward-return studies, annotations, and activity record all share one state model.

> QuantMCP is a research environment, not a trading system or financial advice. It has no broker integration, execution capability, market-data API, authentication, database, or OpenAI API integration.

## Overview

The application loads real, curated 1-minute continuous-futures demo data in the browser, derives 5m, 15m, 30m, and 1h bars deterministically, and runs no-lookahead condition scans and forward-return event studies. It is a static Vite SPA: deployment needs no secrets or server-side service.

## Why WebMCP

WebMCP lets a compatible agent operate the same browser workspace as the researcher through genuine `document.modelContext.registerTool(...)` registrations. QuantMCP deliberately does not embed a chatbot. In unsupported browsers, the full human research workspace remains available and the header accurately reports WebMCP as unavailable.

## Key Features

- Real curated OHLCV demo data for 8 continuous-futures symbols.
- Cached deterministic 1m, 5m, 15m, 30m, and 1h aggregation.
- Structured AND-combined historical condition scans without lookahead.
- Forward simple-return event studies with sample size, mean, median, win rate, and dispersion.
- Deterministic chart-marker cap: all events remain statistical inputs even when only representative markers are drawn.
- Shared human-agent state, chart focus, annotations, and compact Agent Activity.
- 13 native WebMCP tools, including timeframe control and read-only cross-timeframe comparison.

## Human + Agent Workflow

```text
Researcher selects market and timeframe
                  │
                  ▼
          Shared workspace state
             │                │
             ▼                ▼
   Deterministic quant engine  WebMCP tools
             │                │
             └───────┬────────┘
                     ▼
       Chart, study, metrics, annotations, activity
```

## WebMCP Tools

| Tool | Access | Purpose |
| --- | --- | --- |
| `get_workspace_state` | Read | Compact shared-workspace snapshot. |
| `set_active_asset` | Write | Load an available continuous-futures demo dataset. |
| `set_timeframe` | Write | Switch the shared workspace among 1m, 5m, 15m, 30m, and 1h. |
| `focus_chart_range` | Write | Focus a chart range or current event. |
| `get_market_data` | Read | Return bounded real OHLCV data. |
| `calculate_indicator` | Read | Calculate a supported deterministic indicator. |
| `get_dataset_summary` | Read | Read compact dataset metadata and validation. |
| `query_market_conditions` | Write | Scan structured historical conditions. |
| `calculate_forward_returns` | Write | Run a forward-return event study. |
| `annotate_chart` | Write | Add a safe annotation on an active bar or event. |
| `create_research_finding` | Write | Save a concise historical observation. |
| `get_selected_event` | Read | Read the currently selected event. |
| `compare_timeframes` | Read | Compare a condition study across derived timeframes. |

Tool contracts and manual compatible-browser testing are documented in [docs/webmcp-tools.md](docs/webmcp-tools.md).

## Multi-Timeframe Research

The one-minute dataset is canonical. Derived views use fixed clock-aligned buckets after source timestamps are normalized from `America/Chicago`; browser-local time is never used for aggregation. Open is the first source open, high/low are extrema, close is the final source close, and volume is summed only when present. No missing bars are interpolated or synthesized. Incomplete edge buckets are retained.

Changing timeframe updates the chart and metrics and safely clears bar-indexed events, event studies, and annotations so 1m research is never silently displayed on a 15m chart. Read-only `compare_timeframes` does not move the human-visible chart.

## Architecture

| Area | Location | Role |
| --- | --- | --- |
| UI | `src/components`, `src/App.tsx` | Present the workspace and collect human intent. |
| Shared state | `src/store` | Single bridge for human and WebMCP actions. |
| Data | `src/data` | Parse, normalize, validate, load, and derive OHLCV views. |
| Quant | `src/quant` | Deterministic indicators, statistics, scans, and event studies. |
| WebMCP | `src/webmcp` | Strict tool schemas and thin shared-service orchestration. |

Further detail: [docs/architecture.md](docs/architecture.md) and [docs/condition-engine.md](docs/condition-engine.md).

## Demo Market Data

The deployable application tracks eight curated **real** one-minute data windows in `public/data/` (about 19 MB total): 6B, 6C, 6E, ES, GC, NQ, YM, and ZC. Each is mechanically extracted from the newest fixed 2,500,000-byte portion of its supplied chronological continuous-futures source file, with the potentially partial first record discarded. No rows are fabricated, interpolated, or selected based on future returns, event counts, or favorable outcomes.

The original 23.35-million-row corpus (about 1.1 GB) remains a local research input and is intentionally ignored by Git. It is too large for ordinary GitHub and Vercel deployment. The public demo windows retain enough real bars for chart inspection, aggregation, scans, and event studies. Their reproducible derivation command is [scripts/create-demo-data.sh](scripts/create-demo-data.sh); full provenance is in [docs/demo-data.md](docs/demo-data.md).

## Running Locally

Requires Node.js 20.19+ or 22.12+ (per the Vite dependency engine).

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite. The app loads NQ by default; select another market or timeframe from the workspace.

## Testing WebMCP

1. Use a compatible WebMCP-enabled browser and open the app over HTTPS after deployment (or a local development URL for development testing).
2. Confirm the header reports `WEBMCP · Ready · 13 Tools`. Unsupported browsers should show `Unavailable` without affecting human controls.
3. Call `get_workspace_state`, then `set_active_asset` and `set_timeframe`.
4. Call `query_market_conditions`, `calculate_forward_returns`, `focus_chart_range`, and `annotate_chart`.
5. Confirm the chart, research study, and Agent Activity panel reflect the same workspace changes.

## Production Build

```bash
npm run typecheck
npm test
npm run build
```

Vercel settings: **Framework Preset: Vite**, **Install Command: `npm ci`**, **Build Command: `npm run build`**, **Output Directory: `dist`**. No `vercel.json`, environment variables, rewrites, or serverless functions are required for this single-page static app.

Use the [release smoke test](docs/release-smoke-test.md) after the public HTTPS deployment.

## Project Structure

```text
public/data/       Curated real deployable demo datasets
src/components/    Terminal UI by domain
src/data/          OHLCV parsing, validation, loading, aggregation
src/quant/         Deterministic analytical engine
src/store/         Shared human-agent workspace store
src/webmcp/        Native WebMCP registrations and contracts
docs/              Architecture and methodology documentation
```

## Limitations

- The public build uses curated recent data windows, not the full local corpus.
- Aggregation is clock-aligned; it does not implement exchange-specific RTH/ETH session handling.
- Browser support for WebMCP is still platform-dependent; the app degrades to human-only mode when unavailable.
- Findings describe historical samples only and should not be interpreted as trading recommendations.

## Disclaimer

Historical quantitative analysis does not predict future performance. QuantMCP is educational research software and not financial, investment, legal, or tax advice.

## License

Distributed under the [MIT License](LICENSE).
