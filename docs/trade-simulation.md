# Historical Trade Simulation

Trade Study turns existing historical condition events into deterministic simulated trades. It is research visualization only: no broker, order, account, or live-market capability exists.

## Rules

- Default entry: **next bar open**. A condition is known only after its event bar has closed, so the simulator never enters on information unavailable at the decision point.
- Stops: fixed percent or ATR (`period × multiplier`). ATR is evaluated on the event bar, before the entry bar and every later bar.
- Targets: fixed percent, ATR, or an R multiple of the computed stop distance.
- Default collision policy: **stop first**. If one OHLC bar reaches both stop and target, the conservative stop is recorded. `target_first` and `ambiguous` are explicit alternatives; ambiguous trades remain visible but are excluded from aggregate statistics.
- Timeout: when neither level is reached, exit at the close of `maxHoldingBars` after entry. If source history ends first, classify `end_of_data` and exit at its final close.

The selected trade receives three chart price lines plus a bounded, original risk/reward overlay from entry timestamp through exit timestamp. Other trades are entry/exit markers only, capped at 100 displayed trades. This keeps long studies legible.

Aggregate statistics report target, stop, timeout, end-of-data, and ambiguous outcomes; win rate, average/median R, profit factor, hit rates, and maximum consecutive losses use non-ambiguous trades only. Overlapping events, commissions/slippage, and intrabar sequence are not modeled, so historical results are not a trading recommendation.
