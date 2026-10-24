#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE_DIR="$ROOT/.update"
LOCK="$STATE_DIR/lock"

acquire_lock() {
  (set -o noclobber; echo "$$" >"$LOCK") 2>/dev/null
}

on_exit() {
  local code=$?
  # The marks of the last successful run weight the next run's progress bar.
  if [ "$code" -eq 0 ] && [ -s "$STATE_DIR/steps" ]; then
    cp "$STATE_DIR/steps" "$STATE_DIR/steps.last" 2>/dev/null || true
  fi
  # Written before the lock goes so a reader never sees neither file mid-exit.
  echo "$code" >"$STATE_DIR/result"
  if [ "$(cat "$LOCK" 2>/dev/null)" = "$$" ]; then
    rm -f "$LOCK"
  fi
}

main() {
  cd "$ROOT"
  mkdir -p "$STATE_DIR"

  if ! acquire_lock; then
    local holder
    holder="$(cat "$LOCK" 2>/dev/null || true)"
    if [ -n "$holder" ] && kill -0 "$holder" 2>/dev/null; then
      echo "An update is already running (pid $holder)." >&2
      exit 75
    fi
    rm -f "$LOCK"
    if ! acquire_lock; then
      echo "Another update took the lock." >&2
      exit 75
    fi
  fi

  trap on_exit EXIT
  rm -f "$STATE_DIR/result" "$STATE_DIR/steps"
  export DEPLOY_STEPS_FILE="$STATE_DIR/steps"
  exec >"$STATE_DIR/update.log" 2>&1

  local before
  before="$(git rev-parse HEAD)"
  echo "==> Pulling latest changes..."
  git pull --ff-only

  if [ "$(git rev-parse HEAD)" = "$before" ]; then
    echo "==> Already up to date"
    exit 0
  fi

  bash ./update.sh
}

# The pull can rewrite this file while bash is still reading it. Calling main
# and exiting on one line means bash has parsed everything it will run.
main "$@"; exit
