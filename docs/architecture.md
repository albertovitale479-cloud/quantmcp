# Architecture

QuantMCP is a client-side research workspace built around one source of truth. It separates presentation, data ingestion, deterministic quantitative work, and agent-facing orchestration.

```text
Human ──> React UI ──> Workspace store <── WebMCP agent tools
                              │
                              ├── Data layer (OHLCV parsing and loading)
                              └── Quant layer (deterministic calculations)
```

## Boundaries

| Layer | Location | Responsibility |
| --- | --- | --- |
| UI | `src/components`, `src/App.tsx` | Present workspace state and collect human intent. No quantitative formulas. |
| Shared state | `src/store` | The single bridge for human and future agent changes. |
| Data | `src/data` | Source catalog, Central Time normalization, validation, parsing, and ranged local loading. No analysis logic. |
| Quant engine | `src/quant` | Deterministic indicators, statistics, scans, and event studies. |
| WebMCP | `src/webmcp` | Typed agent-tool input boundaries and orchestration. No duplicated quant logic. |

## State management

The project uses a small, dependency-free external store built on React's `useSyncExternalStore`. This provides a framework-native subscription model without adding a state-management dependency before the workspace interactions justify one. State writes are explicit action methods and every WebMCP tool should use the same actions as the UI.

## Data lifecycle

1. A selected source is requested in a bounded recent window through `data/loader.ts`.
2. `data/parser.ts`, `data/normalizer.ts`, and `data/validator.ts` parse, normalize Central Time timestamps, validate OHLCV ranges, reject bad rows, and create a report.
3. The validated one-minute `MarketDataset` enters the workspace store once. A cached aggregation service derives 5m, 15m, 30m, and 1h views only on demand.
4. Derived views use fixed clock-aligned epoch buckets after America/Chicago source timestamps are normalized. This avoids browser-local-time conversion; incomplete buckets remain and source gaps are not filled.
5. Pure quant functions receive the active view’s bars and return metrics, events, and event-study outputs.
6. Lightweight Charts and the research UI render those shared outputs; WebMCP tools invoke the same functions.

The supplied source observations live locally and are never represented as invented data. This repository has no market-data API, backend, database, authentication, or trading capability.
