#!/usr/bin/env bash
# Start (or rebuild) one site instance.
# Usage: ./scripts/up-site.sh site1
#        ./scripts/up-site.sh site2
set -euo pipefail

SITE="${1:-}"
if [[ -z "$SITE" ]]; then
  echo "Usage: $0 <site-name>"
  echo "Example: $0 site1"
  echo "Available:"
  ls -1 sites 2>/dev/null | sed 's/^/  - /' || true
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/sites/$SITE/.env"
EXAMPLE="$ROOT/sites/$SITE/.env.example"

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$EXAMPLE" ]]; then
    cp "$EXAMPLE" "$ENV_FILE"
    echo "Created $ENV_FILE from example — edit passwords before production use."
  else
    echo "Missing $ENV_FILE (and no .env.example). Create sites/$SITE/ first."
    exit 1
  fi
fi

mkdir -p "$ROOT/sites/$SITE/data" "$ROOT/sites/$SITE/uploads/ads"
if [[ ! -f "$ROOT/sites/$SITE/data/ads.json" && -f "$ROOT/data/ads.json" ]]; then
  cp "$ROOT/data/ads.json" "$ROOT/sites/$SITE/data/ads.json"
fi

if command -v chown >/dev/null 2>&1; then
  chown -R 1001:1001 "$ROOT/sites/$SITE/data" "$ROOT/sites/$SITE/uploads" 2>/dev/null || true
fi
# Allow nginx to read uploaded files directly
chmod o+x /root 2>/dev/null || true
chmod -R o+rX "$ROOT/sites/$SITE/uploads"

# shellcheck disable=SC1090
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

PROJECT="${COMPOSE_PROJECT_NAME:-luugyi-$SITE}"

cd "$ROOT"
echo "Starting project=$PROJECT env=$ENV_FILE port=${HOST_PORT:-3000}"
docker compose --env-file "$ENV_FILE" -p "$PROJECT" up -d --build

echo
echo "Site URL:  ${NEXT_PUBLIC_SITE_URL}"
echo "Admin:     ${NEXT_PUBLIC_SITE_URL}/${NEXT_PUBLIC_ADMIN_PATH}"
echo "Stop with: docker compose --env-file $ENV_FILE -p $PROJECT down"
