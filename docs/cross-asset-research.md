# Cross-asset research methodology

Universe Research compares only one requested timeframe and one forward horizon at a time. Each selected source is deterministically aggregated, clipped to the shared overlapping date interval, and scanned with the identical AND-combined condition definition. No missing bars are interpolated.

## Causality and validation

Indicators use the current bar and prior bars only. The chronological split is 70% training and 30% test by default; the boundary bar begins the test interval. Parameter configurations are evaluated and neighborhood-stabilized from training metrics only. Test events must have both their event bar and forward-return bar inside the test interval, so a return cannot cross the split. There is no shuffle, random fold, or full-sample indicator normalization.

## Transparent scores

For an adequately sampled period, the bounded 0–100 metric score is:

`30% standardized mean expectancy + 25% median-return component + 15% win rate + 20% sample confidence − 10% maximum-adverse-return penalty`.

Standardized expectancy is `50 + 20 × mean / standard deviation`, clamped to 0–100. The median and downside terms are scaled in fractional-return units and likewise clamped; this keeps no single outlier return unbounded. Sample confidence reaches 100 at the configured minimum-event count (default 30). Any period with fewer than the minimum usable forward samples is classified **Insufficient sample** and receives no rank.

An asset's research score is `70% test score + 20% train score + 10` only when test quality is at least 70% of train quality. Test evidence therefore dominates and a training-only peak does not rank.

## Robust parameter regions

Each candidate inspects grid configurations differing in exactly one parameter. Its robustness is the median neighboring **training** score minus half the neighboring-score population standard deviation, bounded to 0–100. The final parameter score is `60% test + 15% train + 25% robustness`. Candidates lacking either a train or test minimum sample are rejected. The UI calls these *top robust regions*, not perfect settings.

`optimize_universe` uses the median asset-specific configuration score and subtracts up to 30 points for the share of assets that fail the sample rule. This makes a broadly adequate configuration preferable to one carried by a single market. The grid is capped at 1,000 combinations before any scan begins.

## Statistical limits

This is historical event research on curated continuous-futures windows, not a forecast or trade recommendation. Events can overlap, transaction costs and roll mechanics are not modeled, and a single chronological holdout is weaker evidence than repeated walk-forward validation. Results should be treated as the strongest tested historical region in this bounded data set, never a universal winner.
