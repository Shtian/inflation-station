#!/usr/bin/env bash
# Takes a consistent snapshot of the SQLite database (safe while the app is running).
# Usage: scripts/backup-db.sh [output-dir]
# Default output dir: <database dir>/backups
# DATABASE_URL from the environment takes precedence over .env.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

if [ -z "${DATABASE_URL:-}" ] && [ -f .env ]; then
  set -a && source .env && set +a
fi

if [[ "${DATABASE_URL:-}" != file:* ]]; then
  echo "DATABASE_URL must be a file: URL (check .env)" >&2
  exit 1
fi

DB_PATH="${DATABASE_URL#file:}"
DB_PATH="$(realpath -m "$DB_PATH")"
if [ ! -f "$DB_PATH" ]; then
  echo "No database at $DB_PATH" >&2
  exit 1
fi

OUT_DIR="$(realpath -m "${1:-$(dirname "$DB_PATH")/backups}")"
mkdir -p "$OUT_DIR"

TARGET="$OUT_DIR/data-$(date +%Y%m%d-%H%M%S).db"

# VACUUM INTO writes a consistent copy, including WAL contents.
node --no-warnings -e '
  const { DatabaseSync } = require("node:sqlite");
  const [src, dst] = process.argv.slice(1);
  const db = new DatabaseSync(src, { readOnly: true });
  try { db.prepare("VACUUM INTO ?").run(dst); } finally { db.close(); }
' "$DB_PATH" "$TARGET"

echo "Backed up $DB_PATH -> $TARGET"
