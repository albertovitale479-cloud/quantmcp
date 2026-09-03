# Historical condition engine

`src/quant/marketScanner.ts` evaluates composable conditions with AND semantics. The scanner accepts close-versus-SMA/EMA, RSI, ATR, rolling volatility, rolling-volatility percentile, Z-score, momentum, and previous-window high/low conditions.

Every condition is evaluated at bar `i` using data at `i` or earlier only. Previous high/low explicitly excludes the current bar. Volatility percentile uses a configurable history window ending at the current bar, never the complete sample. Events are identified before `eventStudy.ts` calculates any future close return.

The current UI exposes an RSI(14) below 30 scan as a working reference query. The module accepts the broader typed condition model directly, ready for an expanded condition builder or a future WebMCP tool.

Forward-return results are reported independently per horizon. An event is excluded only from a horizon for which the required future bar does not exist.
