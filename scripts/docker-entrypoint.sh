#!/usr/bin/env bash
# Starts the app in the Docker image: backs up and migrates the database,
# then hands the process over to the server.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ "${DATABASE_URL:-}" != file:* ]]; then
  echo "DATABASE_URL must be a file: URL, such as file:/data/data.db" >&2
  exit 1
fi

DB_PATH="${DATABASE_URL#file:}"
mkdir -p "$(dirname "$DB_PATH")"

# Skipped on first start, when no database exists yet.
if [ -f "$DB_PATH" ]; then
  echo "==> Backing up database..."
  scripts/backup-db.sh
fi

echo "==> Running migrations..."
node_modules/.bin/prisma migrate deploy

echo "==> Starting server..."
exec node .output/server/index.mjs
