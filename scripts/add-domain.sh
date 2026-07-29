#!/usr/bin/env bash
# Add a NEW domain site on the VPS without touching other projects/sites.
#
# Usage:
#   ./scripts/add-domain.sh <site-name> <domain> <host-port>
#
# Examples:
#   ./scripts/add-domain.sh prod   videos.example.com 8082
#   ./scripts/add-domain.sh site-b asian.example.com  8083
#
# Ports already used on your VPS: 8080 (TeleManager), 8081 (Youtube).
# Use 8082, 8083, 8084… for LuuGyi sites.
set -euo pipefail

NAME="${1:-}"
DOMAIN="${2:-}"
PORT="${3:-}"

if [[ -z "$NAME" || -z "$DOMAIN" || -z "$PORT" ]]; then
  echo "Usage: $0 <site-name> <domain> <host-port>"
  echo "Example: $0 site-b asian.example.com 8083"
  exit 1
fi

DOMAIN="${DOMAIN#http://}"
DOMAIN="${DOMAIN#https://}"
DOMAIN="${DOMAIN%%/*}"
DOMAIN="${DOMAIN%%:*}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/sites/$NAME"
ENV_FILE="$DIR/.env"

if [[ -f "$ENV_FILE" ]]; then
  echo "Site already exists: $DIR"
  echo "To redeploy/upgrade it: ./scripts/upgrade-site.sh $NAME"
  exit 1
fi

# Refuse ports owned by other apps on this VPS
case "$PORT" in
  8080|8081)
    echo "Port $PORT is reserved (TeleManager=8080, Youtube=8081). Use 8082+."
    exit 1
    ;;
esac

rand() { openssl rand -base64 "$1" | tr -d '/+=' | head -c "$2"; }

SLUG="$(rand 18 14)"
USER="adm-$(rand 8 6)"
PASS="$(rand 36 28)"
SECRET="$(rand 48 40)"

mkdir -p "$DIR/data" "$DIR/uploads/ads"
if [[ -f "$ROOT/data/ads.json" ]]; then
  cp "$ROOT/data/ads.json" "$DIR/data/ads.json"
fi
touch "$DIR/uploads/ads/.gitkeep"

# The app runs in Docker as uid/gid 1001; mounted volumes must be writable.
if command -v chown >/dev/null 2>&1; then
  chown -R 1001:1001 "$DIR/data" "$DIR/uploads" 2>/dev/null || true
fi

cat > "$ENV_FILE" <<EOF
COMPOSE_PROJECT_NAME=luugyi-$NAME
HOST_BIND=127.0.0.1
HOST_PORT=$PORT

DATA_DIR=./sites/$NAME/data
UPLOADS_DIR=./sites/$NAME/uploads

NEXT_PUBLIC_SITE_URL=https://${DOMAIN}
ADMIN_PATH=${SLUG}
NEXT_PUBLIC_ADMIN_PATH=${SLUG}

ADMIN_USERNAME=${USER}
ADMIN_PASSWORD=${PASS}
ADMIN_SECRET=${SECRET}

TRUST_PROXY_HEADERS=true
EOF
chmod 600 "$ENV_FILE"

# shellcheck disable=SC1090
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

PROJECT="${COMPOSE_PROJECT_NAME}"

cd "$ROOT"
echo "==> Building & starting $NAME on 127.0.0.1:$PORT"
docker compose --env-file "$ENV_FILE" -p "$PROJECT" up -d --build

echo "==> Waiting for app..."
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null "http://127.0.0.1:${PORT}/"; then
    echo "App is up."
    break
  fi
  if [[ "$i" -eq 30 ]]; then
    echo "App did not respond. Check: docker compose -p $PROJECT logs --tail=80"
    exit 1
  fi
  sleep 2
done

NGINX_AVAILABLE="/etc/nginx/sites-available/luugyi-$NAME"
NGINX_ENABLED="/etc/nginx/sites-enabled/luugyi-$NAME"

if [[ -d /etc/nginx/sites-available ]]; then
  echo "==> Installing nginx site luugyi-$NAME (new file only)"
  sed "s|YOUR-DOMAIN.com|${DOMAIN}|g; s/8082/${PORT}/g; s|UPLOADS_ROOT|${ROOT}/sites/${NAME}/uploads|g" \
    "$ROOT/deploy/nginx-luugyi-zcar.conf" > "$NGINX_AVAILABLE"
  ln -sfn "$NGINX_AVAILABLE" "$NGINX_ENABLED"
  nginx -t
  systemctl reload nginx

  if command -v certbot >/dev/null 2>&1; then
    certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos \
      --register-unsafely-without-email 2>/dev/null \
      || certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
        --register-unsafely-without-email 2>/dev/null \
      || echo "Certbot pending — point DNS, then: certbot --nginx -d $DOMAIN"
  fi
else
  echo "Nginx not found — proxy ${DOMAIN} → 127.0.0.1:${PORT} yourself."
fi

echo
echo "=============================================="
echo "  NEW SITE READY"
echo "=============================================="
echo "  Name:   $NAME"
echo "  Site:   https://${DOMAIN}"
echo "  Admin:  https://${DOMAIN}/${SLUG}"
echo "  User:   ${USER}"
echo "  Pass:   ${PASS}"
echo "  Port:   127.0.0.1:${PORT}"
echo "  Env:    $ENV_FILE"
echo
echo "  Upgrade later: ./scripts/upgrade-site.sh $NAME"
echo "=============================================="
