#!/usr/bin/env bash
# Add proxy cache + gzip + static optimizations to existing nginx vhosts
# WITHOUT touching Certbot SSL blocks. Safe to re-run (idempotent).
#
# Usage:  ./scripts/patch-nginx-cache.sh
set -euo pipefail

# ── 1. Create cache directory ─────────────────────────────────────────
mkdir -p /var/cache/nginx/luugyi
chown www-data:www-data /var/cache/nginx/luugyi 2>/dev/null || true

# ── 2. Add proxy_cache_path to nginx.conf (global, once) ─────────────
NGINX_CONF="/etc/nginx/nginx.conf"
if ! grep -q "luugyi_cache" "$NGINX_CONF"; then
  echo "==> Adding proxy_cache_path to $NGINX_CONF"
  # Insert before the first 'server' or at end of http{} block
  sed -i '/http\s*{/a\    proxy_cache_path /var/cache/nginx/luugyi levels=1:2 keys_zone=luugyi_cache:10m max_size=500m inactive=60m use_temp_path=off;' "$NGINX_CONF"
  echo "  Added proxy_cache_path"
else
  echo "==> proxy_cache_path already in nginx.conf"
fi

# ── 3. Patch each site vhost ──────────────────────────────────────────
for file in /etc/nginx/sites-available/luugyi-*; do
  [[ -f "$file" ]] || continue
  name="$(basename "$file")"
  echo "==> Patching $name"

  # 3a. Add gzip if missing
  if ! grep -q "gzip on" "$file"; then
    sed -i '/client_max_body_size/a\
\
    gzip on;\
    gzip_vary on;\
    gzip_proxied any;\
    gzip_comp_level 5;\
    gzip_min_length 256;\
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;' "$file"
    echo "  + gzip"
  fi

  # 3b. Add sendfile + open_file_cache to /uploads/ if missing
  if grep -q "location /uploads/" "$file" && ! grep -q "sendfile on" "$file"; then
    sed -i '/location \/uploads\//,/}/ {
      /access_log off;/a\
        sendfile on;\
        tcp_nopush on;\
        tcp_nodelay on;\
        gzip off;\
        open_file_cache max=500 inactive=60m;\
        open_file_cache_valid 30m;\
        open_file_cache_min_uses 1;
    }' "$file"
    echo "  + uploads speed (sendfile, open_file_cache)"
  fi

  # 3c. Add proxy_cache to location / if missing
  if ! grep -q "proxy_cache luugyi_cache" "$file"; then
    # Find the main "location / {" block (not /uploads/, not /_next/)
    # and add cache directives after proxy_buffers or proxy_buffering
    python3 - "$file" <<'PY'
import pathlib, sys, re

f = pathlib.Path(sys.argv[1])
text = f.read_text()

# Don't double-add
if "proxy_cache luugyi_cache" in text:
    sys.exit(0)

CACHE_BLOCK = """
        # Tell browsers NOT to cache HTML — always fetch fresh from server
        proxy_hide_header Cache-Control;
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
        add_header Pragma "no-cache" always;

        # Nginx proxy cache — server-side only, instant for repeat visitors
        proxy_cache luugyi_cache;
        proxy_cache_valid 200 60s;
        proxy_cache_valid 301 302 10m;
        proxy_cache_valid 404 1m;
        proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
        proxy_cache_background_update on;
        proxy_cache_lock on;
        proxy_cache_lock_timeout 5s;
        proxy_cache_key "$scheme$host$request_uri";
        add_header X-Cache-Status $upstream_cache_status;"""

# Find proxy_read_timeout in the main location / block
# Insert after the last proxy_ directive line before the closing }
pattern = r"(location / \{[^}]*?proxy_read_timeout\s+\d+s;)"
match = re.search(pattern, text)
if match:
    text = text[:match.end()] + CACHE_BLOCK + text[match.end():]
    f.write_text(text)
    print("  + proxy_cache added")
else:
    print("  ! Could not find insertion point for proxy_cache")
PY
  fi

  echo "  Done: $name"
done

# ── 4. Test & reload ──────────────────────────────────────────────────
echo
echo "==> nginx -t"
nginx -t

echo "==> Reloading nginx"
systemctl reload nginx

echo
echo "All sites patched with proxy cache. Pages now load instantly from cache."
echo "Check with: curl -sI https://your-domain/ | grep X-Cache"
