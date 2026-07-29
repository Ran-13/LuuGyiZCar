#!/usr/bin/env bash
# Fix nginx upload size for one or all LuuGyi site vhosts.
# Sets client_max_body_size to 100m and reloads nginx.
#
# Usage:
#   ./scripts/fix-nginx-upload-size.sh akogyivip
#   ./scripts/fix-nginx-upload-size.sh luugyizcar
#   ./scripts/fix-nginx-upload-size.sh --all
set -euo pipefail

TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  echo "Usage: $0 <site-name> | --all"
  exit 1
fi

fix_one() {
  local name="$1"
  local file="/etc/nginx/sites-available/luugyi-$name"

  if [[ ! -f "$file" ]]; then
    echo "Skip $name (missing $file)"
    return
  fi

  if grep -q "client_max_body_size 100m;" "$file"; then
    echo "$name: already 100m"
    return
  fi

  if grep -q "client_max_body_size" "$file"; then
    sed -i 's/client_max_body_size [0-9]\+[kKmM];/client_max_body_size 100m;/' "$file"
  else
    sed -i '/server_name .*;/a\    client_max_body_size 100m;' "$file"
  fi

  echo "$name: updated"
}

if [[ "$TARGET" == "--all" ]]; then
  for file in /etc/nginx/sites-available/luugyi-*; do
    [[ -f "$file" ]] || continue
    name="$(basename "$file" | sed 's/^luugyi-//')"
    fix_one "$name"
  done
else
  fix_one "$TARGET"
fi

nginx -t
systemctl reload nginx
echo "nginx reloaded successfully."
