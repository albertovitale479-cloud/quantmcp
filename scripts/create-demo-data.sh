#!/usr/bin/env bash
set -euo pipefail

# Rebuild the deployable real-data windows from the local full corpus.
# Rule: take the newest 2,500,000 bytes of each chronological source, then
# discard the potentially partial first record. No prices or timestamps change.
readonly window_bytes=2500000

create_window() {
  local source_file="$1"
  local demo_file="$2"
  tail -c "$window_bytes" "$source_file" | sed '1d' > "public/data/$demo_file"
}

create_window '6B_CONTINUOUS 09-26.txt' '6b-demo-1m.txt'
create_window '6C_CONTINUOUS 09-26.txt' '6c-demo-1m.txt'
create_window '6E_CONTINUOUS 09-26.txt' '6e-demo-1m.txt'
create_window 'ES_CONTINUOUS 09-26.txt' 'es-demo-1m.txt'
create_window 'GC_CONTINUOUS 09-26.txt' 'gc-demo-1m.txt'
create_window 'NQ_CONTINUOUS 09-26.txt' 'nq-demo-1m.txt'
create_window 'YM_CONTINUOUS 09-26.txt' 'ym-demo-1m.txt'
create_window 'ZC_CONTINUOUS 09-26.txt' 'zc-demo-1m.txt'

echo 'Rebuilt eight real public/data demo windows.'
