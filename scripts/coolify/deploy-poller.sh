#!/usr/bin/env bash
# Deploys the Coolify apps when ghcr.io/shtian/inflation-station:latest moves.
# Runs on the VM from inflation-station-deploy-poller.timer.
set -euo pipefail

REGISTRY_URL="${REGISTRY_URL:-https://ghcr.io}"
REPOSITORY="${REPOSITORY:-shtian/inflation-station}"
COOLIFY_URL="${COOLIFY_URL:-http://localhost:8000}"
MANIFEST_TYPES="application/vnd.oci.image.index.v1+json,application/vnd.docker.distribution.manifest.list.v2+json,application/vnd.oci.image.manifest.v1+json,application/vnd.docker.distribution.manifest.v2+json"
STATE_FILE="${STATE_DIRECTORY:?STATE_DIRECTORY is not set}/latest-digest"

fail() {
  echo "$*" >&2
  exit 1
}

: "${COOLIFY_TOKEN:?COOLIFY_TOKEN is not set}"
: "${COOLIFY_APP_UUIDS:?COOLIFY_APP_UUIDS is not set}"

token="$(curl -fsS "$REGISTRY_URL/token?scope=repository:$REPOSITORY:pull" |
  sed -n 's/.*"token" *: *"\([^"]*\)".*/\1/p')" ||
  fail "Could not get a registry token"
[ -n "$token" ] || fail "The registry returned no token"

# A HEAD request reads the digest without pulling, and GHCR doesn't count it
# against the pull rate limit.
digest="$(curl -fsSI \
  -H "Authorization: Bearer $token" \
  -H "Accept: $MANIFEST_TYPES" \
  "$REGISTRY_URL/v2/$REPOSITORY/manifests/latest" |
  tr -d '\r' |
  awk 'tolower($0) ~ /^docker-content-digest:/ { sub(/^[^:]*: */, ""); print }')" ||
  fail "Could not read the digest of $REPOSITORY:latest"
[[ "$digest" =~ ^sha256:[0-9a-f]{64}$ ]] ||
  fail "Unexpected digest for $REPOSITORY:latest: '$digest'"

save_digest() {
  echo "$digest" >"$STATE_FILE.tmp"
  mv "$STATE_FILE.tmp" "$STATE_FILE"
}

if [ ! -f "$STATE_FILE" ]; then
  save_digest
  echo "Recorded $digest without deploying"
  exit 0
fi

if [ "$(cat "$STATE_FILE")" = "$digest" ]; then
  exit 0
fi

echo "$REPOSITORY:latest moved to $digest, deploying $COOLIFY_APP_UUIDS"
# The token goes in through stdin so it stays out of the process list.
response="$(echo "Authorization: Bearer $COOLIFY_TOKEN" |
  curl -sS -H @- -w '\n%{http_code}' \
    "$COOLIFY_URL/api/v1/deploy?uuid=$COOLIFY_APP_UUIDS")" ||
  fail "Could not reach Coolify at $COOLIFY_URL"
status="${response##*$'\n'}"
body="${response%$'\n'*}"
case "$status" in
  2??) ;;
  *) fail "Coolify refused the deploy (HTTP $status): $body" ;;
esac

save_digest
echo "Coolify accepted the deploy: $body"
