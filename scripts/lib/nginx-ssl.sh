#!/usr/bin/env bash
# Shared helpers: obtain a Let's Encrypt cert and wire it into a LuuGyi nginx vhost.
#
# Source it:
#   . "$ROOT/scripts/lib/nginx-ssl.sh"
#   install_luugyi_ssl <site-name> <domain> <port> <uploads-abs-path>

install_luugyi_ssl() {
  local name="$1"
  local domain="$2"
  local port="$3"
  local uploads="$4"

  local available="/etc/nginx/sites-available/luugyi-$name"
  local enabled="/etc/nginx/sites-enabled/luugyi-$name"
  local repo_root
  repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
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

  _write_http_vhost() {
    sed "s|YOUR-DOMAIN.com|${domain}|g; s/8082/${port}/g; s|UPLOADS_ROOT|${uploads}|g" \
      "$template" > "$available"
    if grep -q "proxy_cache_path" "$available"; then
      sed -i '/proxy_cache_path/,/use_temp_path=off;/d' "$available"
    fi
  }

  echo "==> Writing HTTP vhost luugyi-$name (server_name ${domain})"
  _write_http_vhost

  if ! grep -q "server_name ${domain}" "$available"; then
    echo "ERROR: vhost missing server_name ${domain}"
    grep -n server_name "$available" || true
    return 1
  fi

  ln -sfn "$available" "$enabled"
  nginx -t
  systemctl reload nginx

  if ! command -v certbot >/dev/null 2>&1; then
    echo "Certbot not installed — HTTP only."
    return 0
  fi

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

  local live="/etc/letsencrypt/live/$domain"
  if [[ ! -f "$live/fullchain.pem" ]]; then
    echo "Certificate missing at $live/fullchain.pem"
    ls -la /etc/letsencrypt/live/ 2>/dev/null || true
    return 1
  fi

  echo "==> Wiring SSL into luugyi-$name (manual — avoids certbot nginx installer / wrong default cert)"
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
    if (not inserted) and re.search(rf"server_name\s+{re.escape(domain)}", line):
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
