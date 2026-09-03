# Supplied-data audit

All eight supplied files have no header and use the same format: `YYYYMMDD HHMMSS;open;high;low;close;volume`. They are semicolon-delimited, use dot decimals, are chronologically ascending, have an apparent 60-second modal interval, and are interpreted as `America/Chicago`.

| File | Rows | Coverage | Malformed / missing / invalid OHLC | Duplicate / descending | Non-modal positive gaps |
| --- | ---: | --- | --- | --- | ---: |
| 6B_CONTINUOUS 09-26.txt | 3,294,866 | 2016-06-30 → 2026-07-31 | 0 / 0 / 0 | 0 / 0 | 193,980 |
| 6C_CONTINUOUS 09-26.txt | 3,250,604 | 2016-06-30 → 2026-07-31 | 0 / 0 / 0 | 0 / 0 | 226,031 |
| 6E_CONTINUOUS 09-26.txt | 3,503,827 | 2016-06-30 → 2026-07-31 | 0 / 0 / 0 | 0 / 0 | 64,093 |
| ES_CONTINUOUS 09-26.txt | 2,152,355 | 2020-06-30 → 2026-07-31 | 0 / 0 / 0 | 0 / 0 | 2,469 |
| GC_CONTINUOUS 09-26.txt | 2,150,920 | 2020-06-30 → 2026-07-31 | 0 / 0 / 0 | 0 / 0 | 7,041 |
| NQ_CONTINUOUS 09-26.txt | 2,152,802 | 2020-06-30 → 2026-07-31 | 0 / 0 / 0 | 0 / 0 | 2,037 |
| YM_CONTINUOUS 09-26.txt | 5,434,962 | 2010-06-06 → 2026-07-27 | 0 / 0 / 0 | 0 / 0 | 165,005 |
| ZC_CONTINUOUS 09-26.txt | 1,411,086 | 2020-01-02 → 2026-07-27 | 0 / 0 / 0 | 0 / 0 | 176,764 |

The non-modal gaps are observed session and market breaks; they are retained rather than imputed or compressed. The supplied source files together contain 23,351,422 rows (about 1.1 GB) and are intentionally local-only.

## Deployable demo dataset

The public build contains eight real curated source windows in `public/data/`, mechanically extracted from the newest portion of each supplied file. No rows are fabricated, interpolated, or resampled during extraction. The original corpus is retained locally and excluded by `.gitignore`.

These 404,412 tracked bars (about 19 MB) support the deployed chart, deterministic aggregation, scans, and event studies. See [demo-data.md](demo-data.md) for the neutral byte-window rule.

## Phase 4D identity audit

Phase 4D treats dataset identity as a release gate. Run `npm run audit:data` to write a reproducible `docs/data-audit-report.json` containing each source filename, dataset ID, symbol, timestamp range, bar count, first and last ten normalized observations, SHA-256 source checksum, pairwise return correlations, and exact duplicate-row percentages.

The application also exposes `auditDatasets` in `src/data/audit.ts`. It verifies asset-to-file mapping, canonical array identity, normalized canonical-data fingerprints, exact/near duplicates, and pairwise same-timestamp return correlations. Identical source data, shared bar-array references, or an incorrect source mapping are release blockers. Correlation by itself is only classified as expected high correlation.

## Checked release inventory

| Symbol | Dataset ID | Source | Bars | Source range | SHA-256 |
| --- | --- | --- | ---: | --- | --- |
| 6B | `6b` | `6b-demo-1m.txt` | 53,321 | 2026-06-01 15:37 – 2026-07-31 17:00 | `e8458955…aa304a1` |
| 6C | `6c` | `6c-demo-1m.txt` | 49,150 | 2026-06-03 20:09 – 2026-07-31 17:00 | `a97cc614…818dbd1` |
| 6E | `6e` | `6e-demo-1m.txt` | 48,863 | 2026-06-10 20:49 – 2026-07-31 17:00 | `ad263d6a…7fbe429` |
| ES | `es` | `es-demo-1m.txt` | 48,018 | 2026-06-12 13:43 – 2026-07-31 17:00 | `1148c973…ff1a68f` |
| GC | `gc` | `gc-demo-1m.txt` | 48,891 | 2026-06-11 20:19 – 2026-07-31 17:00 | `75618516…bb5688` |
| NQ | `nq` | `nq-demo-1m.txt` | 44,822 | 2026-06-16 21:58 – 2026-07-31 17:00 | `a8ed46b1…9bbacf` |
| YM | `ym` | `ym-demo-1m.txt` | 58,232 | 2026-05-27 18:26 – 2026-07-27 19:00 | `99518246…19314cb` |
| ZC | `zc` | `zc-demo-1m.txt` | 53,115 | 2026-04-28 13:20 – 2026-07-27 14:20 | `ce736881…ffb28f` |

The audit found no source-file collision, canonical-reference sharing, exact duplicate, near-duplicate, or label mapping error. ES/NQ one-minute return correlation is approximately 0.906: this is expected high correlation for equity-index futures, not a data defect. Every other pair is below the 0.90 high-correlation reporting threshold. When all eight assets are selected, Universe Research explicitly compares the common window from 2026-06-16 21:58 through 2026-07-27 14:20 (then applies the requested shared aggregation).
