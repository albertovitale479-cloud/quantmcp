# WebMCP tools

QuantMCP registers native browser tools with `document.modelContext.registerTool(...)`. Each executor reads current state from the dependency-free shared store at call time, then delegates to `src/services/workspaceService.ts`; the human UI calls that same service layer. The tool modules therefore contain no duplicate market formulas or data parsing.

| Tool | Read/write | Input | Output and human UI effect | Service / example agent request |
| --- | --- | --- | --- | --- |
| `get_workspace_state` | Read | `{}` | Compact asset, dataset range, selected event, findings, metrics, and chart range. No UI change. | `getCompactWorkspaceState`; “What is the researcher viewing?” |
| `set_active_asset` | Write | `{ asset }` | Previous/new asset and loaded range; updates chart and metrics. | `activateAsset`; “Load NQ.” |
| `set_timeframe` | Write | `{ timeframe }` | Switches the shared chart and metric context to cached 1m/5m/15m/30m/1h data. Bar-indexed events, studies, and annotations clear safely. | `setTimeframe`; “Switch NQ to 15m.” |
| `get_market_data` | Read | `{ asset?, start?, end?, maxBars? }` | At most 500 real OHLCV bars from the active loaded asset. No UI change. | `getMarketData`; “Give me 100 recent NQ bars.” |
| `calculate_indicator` | Read | `{ indicator, period, asset?, start?, end?, maxValues? }` | Bounded indicator series and latest value. No UI change. | `calculateIndicator`; “Calculate RSI(14).” |
| `query_market_conditions` | Write | `{ asset?, conditions }` | Compact event list; markers and event count update. | `queryMarketConditions` → `scanMarketConditions`; “Find close above SMA(200) with RSI below 35.” |
| `calculate_forward_returns` | Write | `{ horizons, asset?, eventIds? }` | Per-horizon sample size, mean, median, win rate, deviation, min/max; study panel updates. | `calculateWorkspaceForwardReturns` → `calculateForwardReturns`; “Analyze 1, 5, 10, 20 bars.” |
| `focus_chart_range` | Write | `{ eventId }` or `{ start, end }` | Validated visible range; chart moves without reload. | `focusChart`; “Focus this event.” |
| `annotate_chart` | Write | `{ eventId | timestamp, type, label, description? }` | Safe plain-text marker stored in state and shown on the chart. | `annotateChart`; “Mark this historical case.” |
| `create_research_finding` | Write | `{ title, summary, confidence, relatedEventIds? }` | Historical observation persisted in workspace state; buy/sell labels are rejected. | `createResearchFinding`; “Save this finding.” |
| `get_dataset_summary` | Read | `{ asset? }` | Compact source metadata and validation report. No UI change. | `getDatasetSummary`; “What data is loaded?” |
| `get_selected_event` | Read | `{}` | Selected event detail. No UI change. | `getSelectedEvent`; “Which event is selected?” |
| `compare_timeframes` | Read | `{ timeframes, conditions, forwardHorizons, asset? }` | Runs isolated scans and event studies on cached derived views; it does not move the human chart. | `compareTimeframes`; “Compare this setup on 5m, 15m, and 1h.” |

All tool inputs use strict JSON Schemas (`additionalProperties: false`) plus semantic validation. Errors are returned as concise codes such as `INVALID_ASSET`, `INVALID_RANGE`, `NO_ACTIVE_DATASET`, `NO_MARKET_EVENTS`, and `INSUFFICIENT_HISTORY`. Market-data responses are bounded to 500 bars/values; scans return at most 100 event records while still updating all workspace events.

## Agent activity

Every invocation writes a running then success/error entry to the shared Agent Activity feed. The feed shows the tool name, concise result, timestamp, and duration without exposing full tool JSON by default.

## Manual browser verification

1. Use a compatible Chrome build and enable `chrome://flags/#enable-webmcp-testing`.
2. Relaunch Chrome, run `npm run dev`, and open QuantMCP.
3. Confirm the header changes from “WebMCP available” to “Tools registered.” Unsupported browsers instead show “WebMCP unavailable” and retain every human feature.
4. Use `get_workspace_state`, then `set_active_asset` with `NQ`.
5. Call `query_market_conditions` with a structured condition array, then `calculate_forward_returns` with `[1, 5, 10, 20]`.
6. Call `focus_chart_range` with one returned event ID and `annotate_chart` for that event. Verify markers, study statistics, chart focus, and activity entries in the visible workspace.
