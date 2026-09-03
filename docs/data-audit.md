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

The non-modal gaps were retained as observed session and market breaks. They are not imputed or compressed. The supplied source files together contain 23,351,422 rows (about 1.1 GB) and are intentionally local-only: they exceed practical GitHub/Vercel repository limits.

## Deployable demo dataset

The public build contains eight real curated source windows in `public/data/`, created mechanically from the newest portion of each supplied file. No rows are fabricated, interpolated, or resampled during extraction. The original corpus is retained locally and excluded by `.gitignore`.

| Symbol | Public file | Bars | Approx. size |
| --- | --- | ---: | ---: |
| 6B | `6b-demo-1m.txt` | 53,321 | 2.4 MB |
| 6C | `6c-demo-1m.txt` | 49,150 | 2.4 MB |
| 6E | `6e-demo-1m.txt` | 48,863 | 2.4 MB |
| ES | `es-demo-1m.txt` | 48,018 | 2.4 MB |
| GC | `gc-demo-1m.txt` | 48,891 | 2.4 MB |
| NQ | `nq-demo-1m.txt` | 44,822 | 2.4 MB |
| YM | `ym-demo-1m.txt` | 58,232 | 2.4 MB |
| ZC | `zc-demo-1m.txt` | 53,115 | 2.4 MB |

These 404,412 tracked bars (about 19 MB) are sufficient for the deployed chart, multi-timeframe aggregation, condition scans, and forward-return studies. The browser loads them through `/data/<filename>`, a Vite public-asset path that works at a root-domain Vercel deployment. See [demo-data.md](demo-data.md) for the exact neutral byte-window rule, ranges, and integrity result.
