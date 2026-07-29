#!/usr/bin/env bash
# Regenerate ALL nginx vhost files from the latest template for maximum speed.
# Preserves Certbot SSL blocks — only the http{} server block is replaced.
#
# Usage:  ./scripts/fix-nginx-speed.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATE="$ROOT/deploy/nginx-luugyi-zcar.conf"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "Missing template: $TEMPLATE"
  exit 1
fi

shopt -s nullglob
envs=("$ROOT"/sites/*/.env)
if [[ ${#envs[@]} -eq 0 ]]; then
  echo "No sites found."
  exit 0
fi

for env in "${envs[@]}"; do
  name="$(basename "$(dirname "$env")")"
  # Skip backups
  [[ "$name" == *.bak-* ]] && continue

  # Read domain and port from .env
  DOMAIN="" PORT=""
  while IFS='=' read -r key val; do
    case "$key" in
      NEXT_PUBLIC_SITE_URL) DOMAIN="${val#https://}"; DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN%%/*}" ;;
      HOST_PORT) PORT="$val" ;;
    esac
  done < "$env"

  if [[ -z "$DOMAIN" || -z "$PORT" ]]; then
    echo "Skip $name (missing DOMAIN or PORT in .env)"
    continue
  fi

  FILE="/etc/nginx/sites-available/luugyi-$name"
  UPLOADS_ROOT="$ROOT/sites/$name/uploads"

  echo "==> Regenerating $FILE ($DOMAIN → 127.0.0.1:$PORT)"

  # Generate new http block from template
  sed "s|YOUR-DOMAIN.com|${DOMAIN}|g; s/8082/${PORT}/g; s|UPLOADS_ROOT|${UPLOADS_ROOT}|g" \
    "$TEMPLATE" > "${FILE}.new"

  # If Certbot has already added an SSL server block, preserve it
  if [[ -f "$FILE" ]] && grep -q "managed by Certbot" "$FILE"; then
    # Extract the SSL server block (everything from the second "server {" onwards)
    SSL_BLOCK="$(awk '/managed by Certbot/{found=1} found' "$FILE")"
    if [[ -n "$SSL_BLOCK" ]]; then
      # The certbot-managed lines include listen 443, ssl cert paths, etc.
      # Keep the whole file as certbot wrote it but replace only our http server
      # Simpler: just keep the certbot additions at the end
      echo "" >> "${FILE}.new"
      echo "$SSL_BLOCK" >> "${FILE}.new"
    fi
  fi

  mv "${FILE}.new" "$FILE"
  ln -sfn "$FILE" "/etc/nginx/sites-enabled/luugyi-$name"
  echo "  Done: $name"
done

echo
echo "==> Testing nginx config"
nginx -t

echo "==> Reloading nginx"
systemctl reload nginx

echo
echo "All sites updated with speed-optimized nginx config."
echo "Run 'certbot renew --dry-run' to verify SSL still works."
