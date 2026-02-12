#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LOG_FILE="/tmp/snakes-dev-watch-test.log"
: > "$LOG_FILE"

PORT=3100 npm run dev:live > "$LOG_FILE" 2>&1 &
DEV_PID=$!

cleanup() {
  if kill -0 "$DEV_PID" 2>/dev/null; then
    kill "$DEV_PID" 2>/dev/null || true
    wait "$DEV_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

wait_for_pattern() {
  local pattern="$1"
  local timeout_seconds="$2"
  local waited=0
  while (( waited < timeout_seconds )); do
    if rg -q "$pattern" "$LOG_FILE"; then
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done
  return 1
}

count_starts() {
  rg -c "Snakes and Ladders Server Running" "$LOG_FILE" || true
}

if ! wait_for_pattern "Snakes and Ladders Server Running" 30; then
  echo "FAIL: Dev server did not start within timeout"
  echo "--- log ---"
  cat "$LOG_FILE"
  exit 1
fi

initial_starts="$(count_starts)"

# Frontend file change should NOT restart nodemon when only server.js is watched.
touch public/style.css
sleep 3
starts_after_frontend="$(count_starts)"

if [[ "$starts_after_frontend" != "$initial_starts" ]]; then
  echo "FAIL: Frontend change triggered restart (starts $initial_starts -> $starts_after_frontend)"
  echo "--- log ---"
  cat "$LOG_FILE"
  exit 1
fi

# Backend file change SHOULD restart.
touch server.js
sleep 4
starts_after_backend="$(count_starts)"

if (( starts_after_backend <= starts_after_frontend )); then
  echo "FAIL: Backend change did not trigger restart (starts $starts_after_frontend -> $starts_after_backend)"
  echo "--- log ---"
  cat "$LOG_FILE"
  exit 1
fi

echo "PASS: Frontend changes do not restart; backend changes do restart."
echo "Starts: initial=$initial_starts, after_frontend=$starts_after_frontend, after_backend=$starts_after_backend"
