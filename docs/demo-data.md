# Demo market-data provenance

QuantMCP's public demo datasets are real historical OHLC/OHLCV windows derived mechanically from larger 1-minute source files. No synthetic prices or fabricated observations are used. The full local source corpus is excluded from the public repository due to size constraints.

## Deterministic selection rule

Run `scripts/create-demo-data.sh` from the repository root with the full local source files present. For each chronological source file, the script takes the newest fixed **2,500,000 bytes** and removes the first output line. Removing that line discards the only potentially partial record introduced by byte-boundary selection; every retained line is an original, complete source record. The script does not inspect prices, indicators, events, future returns, or research outcomes.

The supplied continuous-futures source files are semicolon-delimited `YYYYMMDD HHMMSS;open;high;low;close;volume` observations. Timestamps are interpreted as `America/Chicago`; all public files are canonical 1-minute data with volume present.

| Symbol | Full local source | Approx. source size | Public demo file | Bars | Source timestamp range (America/Chicago) |
| --- | --- | ---: | --- | ---: | --- |
| 6B | `6B_CONTINUOUS 09-26.txt` | 148 MB | `6b-demo-1m.txt` | 53,321 | 2026-06-01 15:37 → 2026-07-31 17:00 |
| 6C | `6C_CONTINUOUS 09-26.txt` | 158 MB | `6c-demo-1m.txt` | 49,150 | 2026-06-03 20:09 → 2026-07-31 17:00 |
| 6E | `6E_CONTINUOUS 09-26.txt` | 171 MB | `6e-demo-1m.txt` | 48,863 | 2026-06-10 20:49 → 2026-07-31 17:00 |
| ES | `ES_CONTINUOUS 09-26.txt` | 107 MB | `es-demo-1m.txt` | 48,018 | 2026-06-12 13:43 → 2026-07-31 17:00 |
| GC | `GC_CONTINUOUS 09-26.txt` | 105 MB | `gc-demo-1m.txt` | 48,891 | 2026-06-11 20:19 → 2026-07-31 17:00 |
| NQ | `NQ_CONTINUOUS 09-26.txt` | 114 MB | `nq-demo-1m.txt` | 44,822 | 2026-06-16 21:58 → 2026-07-31 17:00 |
| YM | `YM_CONTINUOUS 09-26.txt` | 223 MB | `ym-demo-1m.txt` | 58,232 | 2026-05-27 18:26 → 2026-07-27 19:00 |
| ZC | `ZC_CONTINUOUS 09-26.txt` | 63 MB | `zc-demo-1m.txt` | 53,115 | 2026-04-28 13:20 → 2026-07-27 14:20 |

Each public demo file is about 2.4 MB. The full source corpus has 23,351,422 rows and about 1.1 GB; it remains local-only.

## Integrity result

The release-data test parses every public file with QuantMCP's production parser and validator. All eight files have complete first and last records, valid timestamps, strictly increasing normalized timestamps, no duplicates, no malformed or missing fields, valid positive OHLC values, valid non-negative volume, and a 60-second modal interval. Session and market gaps are retained as observed rather than filled.

The same test derives every supported timeframe and verifies at least 200 bars at 1h (the shortest public file has 781), then runs the real NQ WebMCP workflow: condition scan, forward-return study, focus, annotation, and Agent Activity.
