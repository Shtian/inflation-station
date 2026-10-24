#!/usr/bin/env bash
set -euo pipefail

# pm2 stores the script path it was started with, so compare against the
# physical path that ecosystem.config.js resolves to.
REPO_DIR="$(cd "$(dirname "$0")" && pwd -P)"
cd "$REPO_DIR"

# Older macOS date prints a literal N for %N, so fall back to whole seconds.
now_ms() {
  local ns
  ns="$(date +%s%N)"
  case "$ns" in
    *[!0-9]*) echo "$(date +%s)000" ;;
    *) echo "$((ns / 1000000))" ;;
  esac
}

STEP="prepare"
STEP_OUTPUT="$(mktemp)"
STEP_TIMES="$(mktemp)"
START_MS="$(now_ms)"

report_to_sentry() {
  local code="$1" end_ms="$2" dsn="${VITE_SENTRY_DSN:-}"
  [ -n "$dsn" ] || return 0

  local rest="${dsn#*://}"
  local key="${rest%%@*}"
  local host_path="${rest#*@}"
  local url="${dsn%%://*}://${host_path%/*}/api/${host_path##*/}/envelope/"

  # Migration errors can echo database values, which stay out of Sentry.
  local output=""
  if [ "$code" -ne 0 ] && [ "$STEP" != "migrate" ]; then
    output="$(tail -n 50 "$STEP_OUTPUT")"
  fi

  DEPLOY_STEP="$STEP" DEPLOY_EXIT="$code" DEPLOY_OUTPUT="$output" \
    DEPLOY_START="$START_MS" DEPLOY_END="$end_ms" DEPLOY_TIMES="$(cat "$STEP_TIMES")" \
    DEPLOY_RELEASE="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)" \
    DEPLOY_APP="${APP_NAME:-}" node -e '
      const e = process.env;
      const failed = e.DEPLOY_EXIT !== "0";
      const environment = e.VITE_SENTRY_ENVIRONMENT || "production";
      const id = crypto.randomUUID().replaceAll("-", "");
      const traceId = crypto.randomUUID().replaceAll("-", "");
      const end = Number(e.DEPLOY_END);
      const outcome = (ok) => (ok ? "success" : "failure");

      const metric = (name, type, unit, value, at, attributes) => ({
        timestamp: at / 1000,
        trace_id: traceId,
        name,
        type,
        ...(unit && { unit }),
        value,
        attributes: Object.fromEntries(
          Object.entries({
            "sentry.release": e.DEPLOY_RELEASE,
            "sentry.environment": environment,
            pm2_app: e.DEPLOY_APP,
            ...attributes,
          }).map(([k, v]) => [k, { value: v, type: "string" }]),
        ),
      });
      const marks = e.DEPLOY_TIMES.split("\n").filter(Boolean).map((l) => l.split(" "));
      const metrics = marks.map(([step, start], i) => {
        const last = i === marks.length - 1;
        const stop = last ? end : Number(marks[i + 1][1]);
        return metric("deploy.step.duration", "distribution", "millisecond", stop - Number(start), stop, {
          deploy_step: step,
          outcome: outcome(!(last && failed)),
        });
      });
      metrics.push(
        metric("deploy.duration", "distribution", "millisecond", end - Number(e.DEPLOY_START), end, {
          outcome: outcome(!failed),
          ...(failed && { deploy_step: e.DEPLOY_STEP }),
        }),
        metric("deploy.completed", "counter", undefined, 1, end, { outcome: outcome(!failed) }),
      );

      const lines = [failed ? { event_id: id } : {}];
      if (failed) {
        lines.push({ type: "event" }, {
          event_id: id,
          timestamp: Date.now() / 1000,
          platform: "other",
          level: "error",
          logger: "update.sh",
          environment,
          release: e.DEPLOY_RELEASE,
          message: { formatted: `Deploy failed at ${e.DEPLOY_STEP} (exit ${e.DEPLOY_EXIT})` },
          fingerprint: ["deploy-failed", e.DEPLOY_STEP],
          tags: { deploy_step: e.DEPLOY_STEP, exit_code: e.DEPLOY_EXIT, pm2_app: e.DEPLOY_APP },
          extra: e.DEPLOY_OUTPUT ? { output_tail: e.DEPLOY_OUTPUT } : {},
          contexts: { trace: { trace_id: traceId, span_id: id.slice(16) } },
        });
      }
      lines.push(
        {
          type: "trace_metric",
          item_count: metrics.length,
          content_type: "application/vnd.sentry.items.trace-metric+json",
        },
        { version: 2, items: metrics },
      );
      process.stdout.write(lines.map((l) => JSON.stringify(l)).join("\n"));
    ' | curl -sS -o /dev/null --connect-timeout 5 --max-time 10 \
    -H "Content-Type: application/x-sentry-envelope" \
    -H "X-Sentry-Auth: Sentry sentry_version=7, sentry_key=${key%%:*}, sentry_client=update.sh/1" \
    --data-binary @- "$url"
}

on_exit() {
  local code=$? end_ms
  end_ms="$(now_ms)"
  if [ "$code" -ne 0 ]; then
    echo "==> Deploy failed at $STEP (exit $code)" >&2
  fi
  report_to_sentry "$code" "$end_ms" || true
  rm -f "$STEP_OUTPUT" "$STEP_TIMES"
  exit "$code"
}
trap on_exit EXIT

run_step() {
  STEP="$1"
  shift
  echo "$STEP $(now_ms)" >> "$STEP_TIMES"
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
