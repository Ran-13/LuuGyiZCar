#!/usr/bin/env bash
# Finish / repair HTTPS for an existing LuuGyi site (after DNS is ready).
#
# Usage:
#   ./scripts/fix-site-ssl.sh <site-name>
#   ./scripts/fix-site-ssl.sh burmamain
#   ./scripts/fix-site-ssl.sh burmamain burmamain.site   # override domain
#
# Reads domain + port from sites/<name>/.env (unless domain override given)
# and wires the cert into /etc/nginx/sites-available/luugyi-<name>.
set -euo pipefail

NAME="${1:-}"
DOMAIN_OVERRIDE="${2:-}"
if [[ -z "$NAME" ]]; then
  echo "Usage: $0 <site-name> [domain]"
  echo "Available:"
  ls -1 "$(cd "$(dirname "$0")/.." && pwd)/sites" 2>/dev/null | sed 's/^/  /' || true
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/sites/$NAME/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — create the site first with add-domain.sh"
  exit 1
fi

# shellcheck disable=SC1090
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

if [[ -n "$DOMAIN_OVERRIDE" ]]; then
  DOMAIN="$DOMAIN_OVERRIDE"
else
  DOMAIN="${NEXT_PUBLIC_SITE_URL:-}"
fi
DOMAIN="${DOMAIN#https://}"
DOMAIN="${DOMAIN#http://}"
DOMAIN="${DOMAIN%%/*}"
DOMAIN="${DOMAIN#www.}"

PORT="${HOST_PORT:-}"

if [[ -z "$DOMAIN" || -z "$PORT" ]]; then
  echo "Need domain + HOST_PORT. Got domain='${DOMAIN}' port='${PORT}'"
  echo "Check $ENV_FILE or pass domain: $0 $NAME burmamain.site"
  exit 1
fi

UPLOADS="$ROOT/sites/$NAME/uploads"
mkdir -p "$UPLOADS"

echo "==> fix-site-ssl"
echo "    site=$NAME"
echo "    domain=$DOMAIN"
echo "    port=$PORT"
echo "    env=$ENV_FILE"
grep -E '^(NEXT_PUBLIC_SITE_URL|HOST_PORT)=' "$ENV_FILE" || true

# shellcheck source=lib/nginx-ssl.sh
. "$ROOT/scripts/lib/nginx-ssl.sh"
# shellcheck source=lib/nginx-cache.sh
. "$ROOT/scripts/lib/nginx-cache.sh"

install_luugyi_ssl "$NAME" "$DOMAIN" "$PORT" "$UPLOADS" "$ROOT"
purge_nginx_cache

echo
echo "Done. Open https://${DOMAIN}"
./scripts/show-site-admin.sh "$NAME" 2>/dev/null || true
