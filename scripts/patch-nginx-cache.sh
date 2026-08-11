#!/usr/bin/env bash
# Sync existing nginx vhosts to the current cache/speed settings WITHOUT
# touching Certbot SSL blocks. Safe to re-run (idempotent).
#
# This both ADDS missing directives and UPDATES ones that have changed, so live
# Certbot-managed sites — which fix-nginx-speed.sh deliberately skips — still
# pick up template changes.
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

  # 3a0. proxy_cache_path belongs only in nginx.conf — strip from vhosts.
  if grep -q "proxy_cache_path" "$file"; then
    sed -i '/proxy_cache_path/,/use_temp_path=off;/d' "$file"
    echo "  - removed duplicate proxy_cache_path from vhost"
  fi

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
        # Browsers revalidate HTML on every view, so deploys are picked up at
        # once. "no-cache" (store + revalidate) rather than "no-store", which
        # would also disable the back/forward cache and make Back re-render.
        proxy_hide_header Cache-Control;
        proxy_hide_header Pragma;
        add_header Cache-Control "no-cache" always;

        # Nginx proxy cache — server-side only, instant for repeat visitors
        proxy_cache luugyi_cache;
        proxy_cache_valid 200 60s;
        proxy_cache_valid 301 302 10m;
        proxy_cache_valid 404 1m;
        proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
        proxy_cache_background_update on;
        proxy_cache_lock on;
        proxy_cache_lock_timeout 5s;
        proxy_cache_key "$scheme$host$request_uri$remote_addr";
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

  # 3d. Migrate vhosts patched by an older version of this script.
  # The add-if-missing guards above skip files that already have proxy_cache,
  # so changed settings would never reach an already-patched site without this.
  python3 - "$file" <<'PY'
import pathlib, re, sys

f = pathlib.Path(sys.argv[1])
text = original = f.read_text()
changes = []

# no-store also disables the back/forward cache, making browser Back
# re-download and re-render the page. no-cache keeps HTML always-revalidated
# without that cost.
new, n = re.subn(
    r'add_header\s+Cache-Control\s+"no-cache,\s*no-store,\s*must-revalidate"\s+always;',
    'add_header Cache-Control "no-cache" always;',
    text,
)
if n:
    text = new
    changes.append("Cache-Control no-store -> no-cache")

# Pragma is HTTP/1.0 and only adds a redundant header; hide the upstream one.
new, n = re.subn(
    r'[ \t]*add_header\s+Pragma\s+"no-cache"\s+always;\n',
    "",
    text,
)
if n:
    text = new
    changes.append("dropped Pragma header")

if "proxy_hide_header Pragma;" not in text and "proxy_hide_header Cache-Control;" in text:
    text = text.replace(
        "proxy_hide_header Cache-Control;",
        "proxy_hide_header Cache-Control;\n        proxy_hide_header Pragma;",
        1,
    )
    changes.append("hide upstream Pragma")

# Per-IP cache key so a Myanmar VPN wall cannot be bypassed via a shared HTML cache.
new, n = re.subn(
    r'proxy_cache_key\s+"\$scheme\$host\$request_uri";',
    'proxy_cache_key "$scheme$host$request_uri$remote_addr";',
    text,
)
if n:
    text = new
    changes.append("proxy_cache_key includes remote_addr")

# A vhost can have proxy_cache (so step 3c is skipped) yet no Cache-Control
# override at all. Next.js' own header then reaches the browser:
#   s-maxage=60, stale-while-revalidate=31535940
# 31535940s is a YEAR — browsers keep serving stale HTML that references the
# previous build's /_next/static hashes, so CSS and assets 404 and the page
# renders unstyled until the visitor force-refreshes. Add the override when the
# main location block is missing it.
main_loc = re.search(r"location / \{(?:[^{}]|\{[^{}]*\})*?\}", text)
if main_loc and "add_header Cache-Control" not in main_loc.group(0):
    block = main_loc.group(0)
    anchor = re.search(r"proxy_read_timeout\s+\d+s;|proxy_cache\s+luugyi_cache;", block)
    if anchor:
        injected = (
            anchor.group(0)
            + "\n\n        # Always revalidate HTML so a deploy is picked up at once."
            + "\n        # no-cache (not no-store) keeps the back/forward cache working."
            + "\n        proxy_hide_header Cache-Control;"
            + "\n        proxy_hide_header Pragma;"
            + '\n        add_header Cache-Control "no-cache" always;'
        )
        text = text.replace(block, block.replace(anchor.group(0), injected, 1), 1)
        changes.append("added missing Cache-Control override (stale-HTML fix)")
    else:
        print("  ! location / has no anchor directive — add Cache-Control manually")

# Image optimization is CPU-bound; without a server-side cache every cold
# browser re-runs the resize/encode in Node.
img = re.search(r"location /_next/image[^{]*\{(?:[^{}]|\{[^{}]*\})*?\}", text)
if img and "proxy_cache luugyi_cache" not in img.group(0):
    block = img.group(0)
    patched = block.replace(
        "proxy_pass",
        (
            "proxy_cache luugyi_cache;\n"
            '        proxy_cache_key "$scheme$host$uri$is_args$args";\n'
            "        proxy_cache_valid 200 30d;\n"
            "        proxy_cache_use_stale error timeout updating;\n"
            "        proxy_cache_background_update on;\n"
            "        proxy_cache_lock on;\n"
            "        proxy_pass"
        ),
        1,
    )
    text = text.replace(block, patched, 1)
    changes.append("proxy_cache for /_next/image")

if text != original:
    f.write_text(text)
    for c in changes:
        print(f"  ~ {c}")
PY

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
