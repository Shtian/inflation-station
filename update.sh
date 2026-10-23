#!/usr/bin/env bash
set -euo pipefail

# pm2 stores the script path it was started with, so compare against the
# physical path that ecosystem.config.js resolves to.
REPO_DIR="$(cd "$(dirname "$0")" && pwd -P)"
cd "$REPO_DIR"

STEP="prepare"
STEP_OUTPUT="$(mktemp)"

report_failure() {
  local code="$1" dsn="${VITE_SENTRY_DSN:-}"
  [ -n "$dsn" ] || return 0

  local rest="${dsn#*://}"
  local key="${rest%%@*}"
  local host_path="${rest#*@}"
  local url="${dsn%%://*}://${host_path%/*}/api/${host_path##*/}/envelope/"

  # Migration errors can echo database values, which stay out of Sentry.
  local output=""
  if [ "$STEP" != "migrate" ]; then
    output="$(tail -n 50 "$STEP_OUTPUT")"
  fi

  DEPLOY_STEP="$STEP" DEPLOY_EXIT="$code" DEPLOY_OUTPUT="$output" \
    DEPLOY_RELEASE="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)" \
    DEPLOY_APP="$APP_NAME" node -e '
      const e = process.env;
      const id = crypto.randomUUID().replaceAll("-", "");
      const event = {
        event_id: id,
        timestamp: Date.now() / 1000,
        platform: "other",
        level: "error",
        logger: "update.sh",
        environment: e.VITE_SENTRY_ENVIRONMENT || "production",
        release: e.DEPLOY_RELEASE,
        message: { formatted: `Deploy failed at ${e.DEPLOY_STEP} (exit ${e.DEPLOY_EXIT})` },
        fingerprint: ["deploy-failed", e.DEPLOY_STEP],
        tags: { deploy_step: e.DEPLOY_STEP, exit_code: e.DEPLOY_EXIT, pm2_app: e.DEPLOY_APP },
        extra: e.DEPLOY_OUTPUT ? { output_tail: e.DEPLOY_OUTPUT } : {},
      };
      process.stdout.write([{ event_id: id }, { type: "event" }, event].map((l) => JSON.stringify(l)).join("\n"));
    ' | curl -sS -o /dev/null --connect-timeout 5 --max-time 10 \
    -H "Content-Type: application/x-sentry-envelope" \
    -H "X-Sentry-Auth: Sentry sentry_version=7, sentry_key=${key%%:*}, sentry_client=update.sh/1" \
    --data-binary @- "$url"
}

on_exit() {
  local code=$?
  if [ "$code" -ne 0 ]; then
    echo "==> Deploy failed at $STEP (exit $code)" >&2
    report_failure "$code" || true
  fi
  rm -f "$STEP_OUTPUT"
  exit "$code"
}
trap on_exit EXIT

run_step() {
  STEP="$1"
  shift
  "$@" 2>&1 | tee "$STEP_OUTPUT"
}

# Load env vars (for DATABASE_URL during migration)
if [ -f .env ]; then
  set -a && source .env && set +a
fi
APP_NAME="${PM2_APP_NAME:-inflation-station}"

# Create DB directory if it doesn't exist yet
if [ -n "${DATABASE_URL:-}" ]; then
  DB_PATH="${DATABASE_URL#file:}"
  mkdir -p "$(dirname "$DB_PATH")"
fi

echo "==> Installing dependencies..."
run_step install pnpm install --frozen-lockfile

# Back up the database before migrations touch it (skipped on first deploy, when no DB exists yet)
if [ -n "${DB_PATH:-}" ] && [ -f "$DB_PATH" ]; then
  echo "==> Backing up database..."
  run_step backup scripts/backup-db.sh
fi

echo "==> Running migrations..."
run_step migrate pnpm db:migrate:deploy

# The build empties .output first, so pm2 runs a copy under .releases that
# the build never touches. A failed build leaves the live release serving.
echo "==> Building..."
run_step build pnpm build

RELEASE_ID="$(date +%Y%m%d%H%M%S)-$(git rev-parse --short HEAD)"

assemble_release() {
  local previous
  previous="$(readlink .releases/current || true)"
  mkdir -p .releases
  mv .output ".releases/$RELEASE_ID"
  # The running server resolved its own directory through this link at
  # start, so it keeps serving the previous release until pm2 restarts it.
  ln -sfn "$RELEASE_ID" .releases/current

  local dir
  for dir in .releases/*; do
    case "${dir#.releases/}" in
      current | "$RELEASE_ID" | "$previous") ;;
      *) rm -rf "$dir" ;;
    esac
  done
}

pm2_script_path() {
  pm2 jlist | node -e '
    let input = "";
    process.stdin.on("data", (d) => (input += d)).on("end", () => {
      try {
        const app = JSON.parse(input).find((a) => a.name === process.argv[1]);
        process.stdout.write(app?.pm2_env?.pm_exec_path ?? "");
      } catch {}
    });
  ' "$APP_NAME"
}

# `pm2 restart` keeps the script path the process was started with, so a
# process from an older layout is recreated from ecosystem.config.js.
restart_app() {
  if [ "$(pm2_script_path)" = "$REPO_DIR/.releases/current/server/index.mjs" ]; then
    pm2 restart "$APP_NAME"
  else
    pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
    pm2 start ecosystem.config.js
    pm2 save
  fi
}

echo "==> Assembling release $RELEASE_ID..."
run_step assemble assemble_release

echo "==> Restarting pm2..."
run_step restart restart_app

echo "==> Done!"
