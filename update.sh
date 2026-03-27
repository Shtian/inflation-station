#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

# Load env vars (for DATABASE_URL during migration)
if [ -f .env ]; then
  set -a && source .env && set +a
fi

# Create DB directory if it doesn't exist yet
if [ -n "${DATABASE_URL:-}" ]; then
  DB_PATH="${DATABASE_URL#file:}"
  mkdir -p "$(dirname "$DB_PATH")"
fi

echo "==> Installing dependencies..."
pnpm install --frozen-lockfile

echo "==> Running migrations..."
pnpm db:migrate:deploy

echo "==> Building..."
pnpm build

echo "==> Restarting pm2..."
pm2 restart inflation-station || pm2 start ecosystem.config.js

echo "==> Done!"
