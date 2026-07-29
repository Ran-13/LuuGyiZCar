#!/usr/bin/env bash
# Upgrade one site to the latest code (git pull + rebuild).
# Ads data, uploads, and admin passwords are preserved (volume + .env).
#
# Usage:
#   ./scripts/upgrade-site.sh prod
#   ./scripts/upgrade-site.sh site-b
set -euo pipefail

SITE="${1:-}"
if [[ -z "$SITE" ]]; then
  echo "Usage: $0 <site-name>"
  echo "Available sites:"
  ls -1 sites 2>/dev/null | sed 's/^/  - /' || true
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/sites/$SITE/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — create the site first with ./scripts/add-domain.sh"
  exit 1
fi

cd "$ROOT"

echo "==> Pulling latest code"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git pull --ff-only || git pull
else
  echo "Not a git repo — skipping pull (code already on disk)."
fi

# shellcheck disable=SC1090
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

PROJECT="${COMPOSE_PROJECT_NAME:-luugyi-$SITE}"

echo "==> Rebuilding $SITE (project=$PROJECT)"
# Ensure nginx can read uploaded files after rebuild
chmod o+x /root 2>/dev/null || true
chmod -R o+rX "$ROOT/sites/$SITE/uploads" 2>/dev/null || true

docker compose --env-file "$ENV_FILE" -p "$PROJECT" up -d --build

echo "==> Waiting for health..."
PORT="${HOST_PORT:-3000}"
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null "http://127.0.0.1:${PORT}/"; then
    echo "OK — https site should be updated."
    break
  fi
  if [[ "$i" -eq 30 ]]; then
    echo "Still starting. Logs:"
    docker compose -p "$PROJECT" logs --tail=40
    exit 1
  fi
  sleep 2
done

echo
echo "Upgraded: ${NEXT_PUBLIC_SITE_URL}"
echo "Admin:    ${NEXT_PUBLIC_SITE_URL}/${NEXT_PUBLIC_ADMIN_PATH}"
echo "Data kept: sites/$SITE/data + sites/$SITE/uploads"
