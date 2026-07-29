#!/usr/bin/env bash
# Remove ONE LuuGyi site and redeploy from scratch (other VPS apps untouched).
#
# Usage:
#   ./scripts/fresh-site.sh <site-name> <domain> <host-port>
#
# Example (akogyivip from zero):
#   ./scripts/fresh-site.sh akogyivip akogyivip.site 8082
#
# WARNING: Deletes sites/<name>/.env (new admin password generated).
# Keeps optional backup at sites/<name>.bak-<timestamp> unless --no-backup
set -euo pipefail

NAME="${1:-}"
DOMAIN="${2:-}"
PORT="${3:-}"
NO_BACKUP=false
if [[ "${4:-}" == "--no-backup" ]]; then NO_BACKUP=true; fi

if [[ -z "$NAME" || -z "$DOMAIN" || -z "$PORT" ]]; then
  echo "Usage: $0 <site-name> <domain> <host-port> [--no-backup]"
  echo "Example: $0 akogyivip akogyivip.site 8082"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/sites/$NAME"
ENV_FILE="$DIR/.env"

echo "==> Fresh setup for site: $NAME ($DOMAIN on port $PORT)"
echo "    TeleManager / Youtube / other LuuGyi sites are NOT stopped."

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
  PROJECT="${COMPOSE_PROJECT_NAME:-luugyi-$NAME}"

  echo "==> Stopping Docker project: $PROJECT"
  docker compose --env-file "$ENV_FILE" -p "$PROJECT" down --remove-orphans 2>/dev/null || true
else
  echo "==> No existing .env — skipping docker down"
  PROJECT="luugyi-$NAME"
  docker compose -p "$PROJECT" down --remove-orphans 2>/dev/null || true
fi

NGINX_AVAILABLE="/etc/nginx/sites-available/luugyi-$NAME"
NGINX_ENABLED="/etc/nginx/sites-enabled/luugyi-$NAME"
if [[ -f "$NGINX_ENABLED" || -f "$NGINX_AVAILABLE" ]]; then
  echo "==> Removing nginx site luugyi-$NAME"
  rm -f "$NGINX_ENABLED" "$NGINX_AVAILABLE"
  if command -v nginx >/dev/null 2>&1; then
    nginx -t && systemctl reload nginx
  fi
fi

if [[ -d "$DIR" ]]; then
  if [[ "$NO_BACKUP" == true ]]; then
    echo "==> Deleting $DIR (no backup)"
    rm -rf "$DIR"
  else
    BACKUP="$ROOT/sites/${NAME}.bak-$(date +%Y%m%d-%H%M%S)"
    echo "==> Backing up $DIR -> $BACKUP"
    mv "$DIR" "$BACKUP"
  fi
fi

echo "==> Deploying clean site"
exec "$ROOT/scripts/add-domain.sh" "$NAME" "$DOMAIN" "$PORT"
