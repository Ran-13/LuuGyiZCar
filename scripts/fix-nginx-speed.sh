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

  # If Certbot has already modified the file, we need to preserve the SSL
  # server block(s). Extract every server{} block that contains "listen 443"
  # or "managed by Certbot", then append them after our new HTTP template.
  SSL_BLOCKS=""
  if [[ -f "$FILE" ]] && grep -q "managed by Certbot" "$FILE"; then
    # Use awk to extract complete server{} blocks containing ssl/certbot
    SSL_BLOCKS="$(awk '
      /^server\s*\{/ { depth=1; block=$0"\n"; next }
      depth > 0 {
        block = block $0 "\n"
        for (i=1; i<=length($0); i++) {
          c = substr($0,i,1)
          if (c == "{") depth++
          if (c == "}") depth--
        }
        if (depth <= 0) {
          if (block ~ /listen 443|managed by Certbot/) print block
          block = ""
        }
      }
    ' "$FILE")"
  fi

  # Generate new http block from template
  sed "s|YOUR-DOMAIN.com|${DOMAIN}|g; s/8082/${PORT}/g; s|UPLOADS_ROOT|${UPLOADS_ROOT}|g" \
    "$TEMPLATE" > "${FILE}.new"

  # Append preserved SSL blocks
  if [[ -n "$SSL_BLOCKS" ]]; then
    printf "\n%s" "$SSL_BLOCKS" >> "${FILE}.new"
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
