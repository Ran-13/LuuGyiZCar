#!/usr/bin/env bash
# Finish / repair HTTPS for an existing LuuGyi site (after DNS is ready).
#
# Usage:
#   ./scripts/fix-site-ssl.sh <site-name>
#   ./scripts/fix-site-ssl.sh burmamain
#   ./scripts/fix-site-ssl.sh apyarcar
#
# Reads domain + port from sites/<name>/.env and (re)installs the cert into
# /etc/nginx/sites-available/luugyi-<name> — does not use certbot's fragile
# nginx installer (which fails when server_name does not match).
set -euo pipefail

NAME="${1:-}"
if [[ -z "$NAME" ]]; then
  echo "Usage: $0 <site-name>"
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

DOMAIN="${NEXT_PUBLIC_SITE_URL:-}"
DOMAIN="${DOMAIN#https://}"
DOMAIN="${DOMAIN#http://}"
DOMAIN="${DOMAIN%%/*}"
PORT="${HOST_PORT:-}"

if [[ -z "$DOMAIN" || -z "$PORT" ]]; then
  echo "sites/$NAME/.env must have NEXT_PUBLIC_SITE_URL and HOST_PORT"
  exit 1
fi

UPLOADS="$ROOT/sites/$NAME/uploads"

# shellcheck source=lib/nginx-ssl.sh
. "$ROOT/scripts/lib/nginx-ssl.sh"

# shellcheck source=lib/nginx-cache.sh
. "$ROOT/scripts/lib/nginx-cache.sh"

install_luugyi_ssl "$NAME" "$DOMAIN" "$PORT" "$UPLOADS"
purge_nginx_cache

echo
echo "Done. Open https://${DOMAIN}"
echo "Admin:  https://${DOMAIN}/${ADMIN_PATH:-admin}"
./scripts/show-site-admin.sh "$NAME" 2>/dev/null || true
