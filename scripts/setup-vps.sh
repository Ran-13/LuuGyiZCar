#!/usr/bin/env bash
# Complete VPS setup for LuuGyi Zcar — does NOT touch TeleManager or Youtube.
#
# Usage (on the VPS, as root or with sudo):
#   cd ~/LuuGyiZCar
#   ./scripts/setup-vps.sh your-domain.com
#
# What it does:
#   1. Creates sites/prod/.env with strong secrets
#   2. Builds & starts Docker on 127.0.0.1:8082
#   3. Installs a NEW nginx site (leaves other sites alone)
#   4. Optionally runs certbot for HTTPS
set -euo pipefail

DOMAIN="${1:-}"
if [[ -z "$DOMAIN" ]]; then
  echo "Usage: $0 <domain>"
  echo "Example: $0 videos.example.com"
  exit 1
fi

DOMAIN="${DOMAIN#http://}"
DOMAIN="${DOMAIN#https://}"
DOMAIN="${DOMAIN%%/*}"
DOMAIN="${DOMAIN%%:*}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f docker-compose.yml ]]; then
  echo "Run this from the LuuGyiZCar project root (docker-compose.yml missing)."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install Docker first."
  exit 1
fi

rand() { openssl rand -base64 "$1" | tr -d '/+=' | head -c "$2"; }

ENV_FILE="$ROOT/sites/prod/.env"
mkdir -p "$ROOT/sites/prod/data" "$ROOT/sites/prod/uploads/ads"

if [[ ! -f "$ROOT/sites/prod/data/ads.json" && -f "$ROOT/data/ads.json" ]]; then
  cp "$ROOT/data/ads.json" "$ROOT/sites/prod/data/ads.json"
fi

if [[ -f "$ENV_FILE" ]]; then
  echo "Using existing $ENV_FILE"
else
  SLUG="$(rand 18 14)"
  USER="adm-$(rand 8 6)"
  PASS="$(rand 36 28)"
  SECRET="$(rand 48 40)"

  cat > "$ENV_FILE" <<EOF
COMPOSE_PROJECT_NAME=luugyi-prod
HOST_BIND=127.0.0.1
HOST_PORT=8082

DATA_DIR=./sites/prod/data
UPLOADS_DIR=./sites/prod/uploads

NEXT_PUBLIC_SITE_URL=https://${DOMAIN}
ADMIN_PATH=${SLUG}
NEXT_PUBLIC_ADMIN_PATH=${SLUG}

ADMIN_USERNAME=${USER}
ADMIN_PASSWORD=${PASS}
ADMIN_SECRET=${SECRET}

TRUST_PROXY_HEADERS=true
EOF
  chmod 600 "$ENV_FILE"
  echo "Created $ENV_FILE"
fi

# Refresh domain in env if file already existed
if grep -q 'NEXT_PUBLIC_SITE_URL=' "$ENV_FILE"; then
  sed -i.bak "s|^NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=https://${DOMAIN}|" "$ENV_FILE"
  rm -f "${ENV_FILE}.bak"
fi

# shellcheck disable=SC1090
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

PROJECT="${COMPOSE_PROJECT_NAME:-luugyi-prod}"

echo
echo "==> Building & starting container (project=$PROJECT, port=${HOST_PORT})"
docker compose --env-file "$ENV_FILE" -p "$PROJECT" up -d --build

echo
echo "==> Waiting for app..."
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null "http://127.0.0.1:${HOST_PORT}/"; then
    echo "App is up on 127.0.0.1:${HOST_PORT}"
    break
  fi
  if [[ "$i" -eq 30 ]]; then
    echo "App did not respond. Check: docker compose -p $PROJECT logs --tail=80"
    exit 1
  fi
  sleep 2
done

NGINX_AVAILABLE="/etc/nginx/sites-available/luugyi-zcar"
NGINX_ENABLED="/etc/nginx/sites-enabled/luugyi-zcar"

if [[ -d /etc/nginx/sites-available ]]; then
  echo
  echo "==> Installing nginx site (new file only)"
  sed "s/YOUR-DOMAIN.com/${DOMAIN}/g" "$ROOT/deploy/nginx-luugyi-zcar.conf" > "$NGINX_AVAILABLE"
  ln -sfn "$NGINX_AVAILABLE" "$NGINX_ENABLED"
  nginx -t
  systemctl reload nginx
  echo "Nginx reloaded."

  if command -v certbot >/dev/null 2>&1; then
    echo
    echo "==> Requesting HTTPS certificate"
    certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email || \
      certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email || \
      echo "Certbot skipped/failed — point DNS first, then run: certbot --nginx -d $DOMAIN"
  else
    echo "Certbot not installed. After DNS works: apt install certbot python3-certbot-nginx && certbot --nginx -d $DOMAIN"
  fi
else
  echo "Nginx sites-available not found — skip nginx step. Proxy to 127.0.0.1:${HOST_PORT} yourself."
fi

echo
echo "=============================================="
echo "  SETUP COMPLETE (other projects untouched)"
echo "=============================================="
echo "  Site:   https://${DOMAIN}"
echo "  Admin:  https://${DOMAIN}/${NEXT_PUBLIC_ADMIN_PATH}"
echo "  User:   ${ADMIN_USERNAME}"
echo "  Pass:   ${ADMIN_PASSWORD}"
echo
echo "  Secrets file: $ENV_FILE  (keep private)"
echo "  Stop only this app:"
echo "    docker compose --env-file $ENV_FILE -p $PROJECT down"
echo "=============================================="
