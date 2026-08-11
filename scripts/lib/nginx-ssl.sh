#!/usr/bin/env bash
# Shared helpers: obtain a Let's Encrypt cert and wire it into a LuuGyi nginx vhost.
#
# Source it:
#   . "$ROOT/scripts/lib/nginx-ssl.sh"
#   install_luugyi_ssl <site-name> <domain> <port> <uploads-abs-path> [repo-root]

# Resolved at source-time (BASH_SOURCE inside a function can point at the caller).
_LUUGYI_SSL_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_LUUGYI_SSL_REPO_ROOT="$(cd "${_LUUGYI_SSL_LIB_DIR}/../.." && pwd)"

install_luugyi_ssl() {
  local name="$1"
  local domain="$2"
  local port="$3"
  local uploads="$4"
  local repo_root="${5:-$_LUUGYI_SSL_REPO_ROOT}"

  domain="${domain#http://}"
  domain="${domain#https://}"
  domain="${domain%%/*}"
  domain="${domain%%:*}"
  domain="${domain#www.}"

  local available="/etc/nginx/sites-available/luugyi-$name"
  local enabled="/etc/nginx/sites-enabled/luugyi-$name"
  local template="$repo_root/deploy/nginx-luugyi-zcar.conf"

  if [[ ! -d /etc/nginx/sites-available ]]; then
    echo "Nginx sites-available missing — skip SSL."
    return 0
  fi
  if [[ ! -f "$template" ]]; then
    echo "Missing nginx template: $template"
    return 1
  fi

  mkdir -p /var/cache/nginx/luugyi
  chown www-data:www-data /var/cache/nginx/luugyi 2>/dev/null || true
  if [[ -f /etc/nginx/nginx.conf ]] && ! grep -q "luugyi_cache" /etc/nginx/nginx.conf; then
    echo "==> Adding proxy_cache_path to /etc/nginx/nginx.conf"
    sed -i '/http\s*{/a\    proxy_cache_path /var/cache/nginx/luugyi levels=1:2 keys_zone=luugyi_cache:10m max_size=500m inactive=60m use_temp_path=off;' \
      /etc/nginx/nginx.conf
  fi

  # Safe vhost render in Python — never use sed ranges that can wipe the file.
  _write_http_vhost() {
    python3 - "$template" "$available" "$domain" "$port" "$uploads" <<'PY'
import pathlib, re, sys

template, available, domain, port, uploads = sys.argv[1:6]
text = pathlib.Path(template).read_text()

# Restore placeholder if a previous run corrupted the template copy text
# (only affects this render; we do not write back to the template).
if "YOUR-DOMAIN.com" not in text and "server_name" in text:
    # Template may already be domain-substituted; still force names below.
    pass

text = text.replace("YOUR-DOMAIN.com", domain)
text = text.replace("8082", str(port))
text = text.replace("UPLOADS_ROOT", uploads)

# Drop proxy_cache_path ONLY if both ends exist nearby (max ~5 lines).
text = re.sub(
    r"(?m)^[ \t]*proxy_cache_path[^\n]*\n(?:[ \t]+[^\n]*\n){0,4}[ \t]*max_size[^\n]*use_temp_path=off;\s*",
    "",
    text,
)
text = re.sub(
    r"(?m)^[ \t]*proxy_cache_path[^\n]*use_temp_path=off;\s*",
    "",
    text,
)

# Force correct server_name
if re.search(r"(?m)^[ \t]*server_name[ \t]", text):
    text = re.sub(
        r"(?m)^[ \t]*server_name[ \t].*;",
        f"    server_name {domain} www.{domain};",
        text,
        count=1,
    )
else:
    text = re.sub(
        r"(?m)^([ \t]*listen \[::\]:80;)",
        rf"\1\n    server_name {domain} www.{domain};",
        text,
        count=1,
    )

if "server {" not in text or f"server_name {domain}" not in text:
    raise SystemExit(
        "Rendered vhost missing server block or server_name. "
        f"template={template} chars={len(text)}"
    )

pathlib.Path(available).write_text(text)
print(f"    wrote {available} ({len(text)} bytes)")
PY
  }

  echo "==> Writing HTTP vhost luugyi-$name"
  echo "    domain=${domain}  port=${port}"
  echo "    template=${template}"
  echo "    vhost=${available}"
  _write_http_vhost

  if ! grep -q "server_name ${domain}" "$available"; then
    echo "ERROR: vhost missing server_name ${domain}"
    echo "---- server_name lines ----"
    grep -n server_name "$available" || echo "(none)"
    echo "---- head of vhost ----"
    head -n 40 "$available" || true
    return 1
  fi
  echo "    OK: $(grep -E '[[:space:]]*server_name' "$available" | head -1 | xargs)"

  ln -sfn "$available" "$enabled"
  nginx -t
  systemctl reload nginx

  if ! command -v certbot >/dev/null 2>&1; then
    echo "Certbot not installed — HTTP only."
    return 0
  fi

  local live="/etc/letsencrypt/live/$domain"
  if [[ ! -f "$live/fullchain.pem" ]]; then
    echo "==> Obtaining certificate for ${domain}"
    if ! certbot certonly --nginx \
        --cert-name "$domain" \
        -d "$domain" -d "www.$domain" \
        --non-interactive --agree-tos --register-unsafely-without-email \
        --keep-until-expiring \
      && ! certbot certonly --nginx \
        --cert-name "$domain" \
        -d "$domain" \
        --non-interactive --agree-tos --register-unsafely-without-email \
        --keep-until-expiring; then
      echo "Certbot could not issue yet (often DNS). Site stays on HTTP."
      echo "When DNS works: ./scripts/fix-site-ssl.sh $name"
      return 0
    fi
  else
    echo "==> Using existing certificate at $live"
  fi

  if [[ ! -f "$live/fullchain.pem" ]]; then
    echo "Certificate missing at $live/fullchain.pem"
    ls -la /etc/letsencrypt/live/ 2>/dev/null || true
    return 1
  fi

  echo "==> Wiring SSL into luugyi-$name"
  python3 - "$template" "$available" "$domain" "$port" "$uploads" "$live" <<'PY'
import pathlib, re, sys

template, available, domain, port, uploads, live = sys.argv[1:7]
text = pathlib.Path(template).read_text()
text = text.replace("YOUR-DOMAIN.com", domain)
text = text.replace("8082", str(port))
text = text.replace("UPLOADS_ROOT", uploads)
text = re.sub(
    r"(?m)^[ \t]*proxy_cache_path[^\n]*\n(?:[ \t]+[^\n]*\n){0,4}[ \t]*max_size[^\n]*use_temp_path=off;\s*",
    "",
    text,
)
text = re.sub(
    r"(?m)^[ \t]*proxy_cache_path[^\n]*use_temp_path=off;\s*",
    "",
    text,
)
text = text.replace("listen 80;", "listen 443 ssl http2;")
text = text.replace("listen [::]:80;", "listen [::]:443 ssl http2;")
text = re.sub(
    r"(?m)^[ \t]*server_name[ \t].*;",
    f"    server_name {domain} www.{domain};",
    text,
    count=1,
)

ssl = [
    f"    ssl_certificate {live}/fullchain.pem;",
    f"    ssl_certificate_key {live}/privkey.pem;",
]
if pathlib.Path("/etc/letsencrypt/options-ssl-nginx.conf").exists():
    ssl.append("    include /etc/letsencrypt/options-ssl-nginx.conf;")
if pathlib.Path("/etc/letsencrypt/ssl-dhparams.pem").exists():
    ssl.append("    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;")

lines = text.splitlines()
out = []
inserted = False
for line in lines:
    out.append(line)
    if (not inserted) and re.search(rf"server_name\s+{re.escape(domain)}\b", line):
        out.extend(ssl)
        inserted = True

if not inserted:
    raise SystemExit("Could not insert ssl_certificate after server_name")

redirect = f"""# Redirect HTTP → HTTPS
server {{
    listen 80;
    listen [::]:80;
    server_name {domain} www.{domain};
    return 301 https://$host$request_uri;
}}

"""
pathlib.Path(available).write_text(redirect + "\n".join(out) + "\n")
print(f"    SSL vhost written ({len(out)} lines)")
PY

  ln -sfn "$available" "$enabled"

  if nginx -t; then
    systemctl reload nginx
    echo "SSL ready: https://${domain}"
  else
    echo "nginx -t failed — restoring HTTP-only vhost"
    _write_http_vhost
    ln -sfn "$available" "$enabled"
    nginx -t && systemctl reload nginx
    return 1
  fi

  if command -v openssl >/dev/null 2>&1; then
    echo "==> Served certificate subject:"
    echo | openssl s_client -servername "$domain" -connect "${domain}:443" 2>/dev/null \
      | openssl x509 -noout -subject -dates 2>/dev/null || true
  fi
  return 0
}
