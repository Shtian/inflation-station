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

# Back up the database before migrations touch it (skipped on first deploy, when no DB exists yet)
if [ -n "${DB_PATH:-}" ] && [ -f "$DB_PATH" ]; then
  echo "==> Backing up database..."
  scripts/backup-db.sh
fi

echo "==> Running migrations..."
pnpm db:migrate:deploy

echo "==> Cleaning output..."
rm -rf .next

echo "==> Building..."
pnpm build

echo "==> Copying static assets to standalone..."
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

echo "==> Restarting pm2..."
pm2 restart "${PM2_APP_NAME:-inflation-station}" || pm2 start ecosystem.config.js

echo "==> Done!"
