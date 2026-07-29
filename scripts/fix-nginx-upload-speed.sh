#!/usr/bin/env bash
# Patch all existing nginx vhosts to serve /uploads/ with maximum speed.
# Adds sendfile, tcp_nopush, open_file_cache, gzip off.
#
# Usage:
#   ./scripts/fix-nginx-upload-speed.sh          # all sites
#   ./scripts/fix-nginx-upload-speed.sh akogyivip # one site
set -euo pipefail

TARGET="${1:-}"

fix_one() {
  local name="$1"
  local file="/etc/nginx/sites-available/luugyi-$name"

  if [[ ! -f "$file" ]]; then
    echo "Skip $name (missing $file)"
    return
  fi

  # Already patched?
  if grep -q "open_file_cache" "$file"; then
    echo "$name: already optimised"
    return
  fi

  # Insert speed directives after the "alias" line inside location /uploads/
  python3 - "$file" <<'PY'
import sys, pathlib, re

f = pathlib.Path(sys.argv[1])
text = f.read_text()

SPEED_BLOCK = """\
        sendfile on;
        tcp_nopush on;
        tcp_nodelay on;
        gzip off;
        open_file_cache max=200 inactive=60m;
        open_file_cache_valid 30m;
        open_file_cache_min_uses 1;"""

# Find the alias line inside location /uploads/
pattern = r"(location /uploads/\s*\{[^\}]*?alias\s+[^;]+;\n\s*access_log\s+off;)"
match = re.search(pattern, text)
if not match:
    print(f"  Could not find insertion point in {f}")
    sys.exit(0)

insert_pos = match.end()
text = text[:insert_pos] + "\n" + SPEED_BLOCK + text[insert_pos:]
f.write_text(text)
PY

  echo "$name: speed directives added"
}

if [[ -z "$TARGET" ]]; then
  for file in /etc/nginx/sites-available/luugyi-*; do
    [[ -f "$file" ]] || continue
    fix_one "$(basename "$file" | sed 's/^luugyi-//')"
  done
else
  fix_one "$TARGET"
fi

nginx -t
systemctl reload nginx
echo "nginx reloaded — uploads now served at max speed."
