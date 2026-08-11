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

  # Normalize domain
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
    echo "  repo_root=$repo_root"
    return 1
  fi

  mkdir -p /var/cache/nginx/luugyi
  chown www-data:www-data /var/cache/nginx/luugyi 2>/dev/null || true
  if [[ -f /etc/nginx/nginx.conf ]] && ! grep -q "luugyi_cache" /etc/nginx/nginx.conf; then
    echo "==> Adding proxy_cache_path to /etc/nginx/nginx.conf"
    sed -i '/http\s*{/a\    proxy_cache_path /var/cache/nginx/luugyi levels=1:2 keys_zone=luugyi_cache:10m max_size=500m inactive=60m use_temp_path=off;' \
      /etc/nginx/nginx.conf
  fi

  _write_http_vhost() {
    sed "s|YOUR-DOMAIN.com|${domain}|g; s/8082/${port}/g; s|UPLOADS_ROOT|${uploads}|g" \
      "$template" > "$available"
    if grep -q "proxy_cache_path" "$available"; then
      sed -i '/proxy_cache_path/,/use_temp_path=off;/d' "$available"
    fi
    # Always force server_name (works even if template placeholder differs).
    if grep -qE '^[[:space:]]*server_name[[:space:]]+' "$available"; then
      sed -i -E "s|^[[:space:]]*server_name[[:space:]].*;|    server_name ${domain} www.${domain};|" "$available"
    else
      sed -i "/listen \[::\]:80;/a\\    server_name ${domain} www.${domain};" "$available"
    fi
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
  echo "    OK server_name: $(grep -E 'server_name' "$available" | head -1 | xargs)"

  ln -sfn "$available" "$enabled"
  nginx -t
  systemctl reload nginx

  if ! command -v certbot >/dev/null 2>&1; then
    echo "Certbot not installed — HTTP only."
    return 0
  fi

  # Prefer an already-issued cert (certbot may have saved it earlier).
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

  echo "==> Wiring SSL into luugyi-$name (manual — avoids wrong default cert)"
  python3 - "$template" "$available" "$domain" "$port" "$uploads" "$live" <<'PY'
import pathlib, re, sys

template, available, domain, port, uploads, live = sys.argv[1:7]
text = pathlib.Path(template).read_text()
text = text.replace("YOUR-DOMAIN.com", domain)
text = text.replace("8082", port)
text = text.replace("UPLOADS_ROOT", uploads)
text = re.sub(r"proxy_cache_path[\s\S]*?use_temp_path=off;\s*", "", text)
text = text.replace("listen 80;", "listen 443 ssl http2;")
text = text.replace("listen [::]:80;", "listen [::]:443 ssl http2;")

# Force a clean server_name line
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
    # Fallback: insert after first listen 443 line
    out = []
    for line in lines:
        out.append(line)
        if (not inserted) and "listen 443" in line:
            out.append(f"    server_name {domain} www.{domain};")
            out.extend(ssl)
            inserted = True

redirect = f"""# Redirect HTTP → HTTPS
server {{
    listen 80;
    listen [::]:80;
    server_name {domain} www.{domain};
    return 301 https://$host$request_uri;
}}

"""
pathlib.Path(available).write_text(redirect + "\n".join(out) + "\n")
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
