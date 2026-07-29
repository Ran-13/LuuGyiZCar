#!/usr/bin/env bash
# Fix existing nginx vhosts so /uploads/ is served directly from the site folder.
# This avoids Next.js 404s for runtime-uploaded GIFs.
#
# Usage:
#   ./scripts/fix-nginx-uploads-alias.sh akogyivip
#   ./scripts/fix-nginx-uploads-alias.sh luugyizcar
#   ./scripts/fix-nginx-uploads-alias.sh --all
set -euo pipefail

TARGET="${1:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -z "$TARGET" ]]; then
  echo "Usage: $0 <site-name> | --all"
  exit 1
fi

fix_one() {
  local name="$1"
  local file="/etc/nginx/sites-available/luugyi-$name"
  local uploads_root="${ROOT}/sites/${name}/uploads"

  if [[ ! -f "$file" ]]; then
    echo "Skip $name (missing $file)"
    return
  fi

  if grep -q "location /uploads/" "$file"; then
    echo "$name: uploads alias already present"
    return
  fi

  python3 - "$file" "$uploads_root" <<'PY'
import sys
from pathlib import Path

file_path = Path(sys.argv[1])
uploads_root = sys.argv[2]
text = file_path.read_text()
needle = "    client_max_body_size 100m;\n"
block = (
    "    client_max_body_size 100m;\n\n"
    "    location /uploads/ {\n"
    f"        alias {uploads_root}/;\n"
    "        access_log off;\n"
    "        expires 30d;\n"
    "        add_header Cache-Control \"public, max-age=2592000, immutable\";\n"
    "    }\n"
)
if needle not in text:
    raise SystemExit(f"Could not find insertion point in {file_path}")
file_path.write_text(text.replace(needle, block, 1))
PY

  echo "$name: uploads alias added"
}

if [[ "$TARGET" == "--all" ]]; then
  for file in /etc/nginx/sites-available/luugyi-*; do
    [[ -f "$file" ]] || continue
    fix_one "$(basename "$file" | sed 's/^luugyi-//')"
  done
else
  fix_one "$TARGET"
fi

nginx -t
systemctl reload nginx
echo "nginx reloaded successfully."
