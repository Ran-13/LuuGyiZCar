#!/usr/bin/env bash
# Fix filesystem permissions so nginx (www-data / other) can read /root and
# serve files from sites/*/uploads/ directly.
#
# Must be run as root on the VPS.
#
# What it does:
#   1. chmod o+x /root          — lets nginx traverse the root home dir
#   2. chmod -R o+rX uploads/   — lets nginx read every site's uploads folder
#   3. nginx -t && reload       — applies any pending nginx config changes
#   4. curl -I <url>            — optional smoke-test (pass --check <url>)
#
# Usage:
#   ./scripts/fix-public-perms.sh            # all existing sites
#   ./scripts/fix-public-perms.sh akogyivip  # one site only
#   ./scripts/fix-public-perms.sh --check https://akogyivip.site/uploads/ads/banner.gif
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-}"
CHECK_URL=""

# Parse optional --check <url>
if [[ "$TARGET" == "--check" ]]; then
  CHECK_URL="${2:-}"
  TARGET=""
elif [[ "$TARGET" == *"://"* ]]; then
  # Convenience: bare URL passed as first arg
  CHECK_URL="$TARGET"
  TARGET=""
fi

# ── Step 1: allow nginx to enter /root ────────────────────────────────────────
echo "==> chmod o+x /root"
chmod o+x /root

# ── Step 2: fix uploads/ for target site(s) ───────────────────────────────────
fix_one() {
  local site="$1"
  local dir="$ROOT/sites/$site/uploads"
  if [[ ! -d "$dir" ]]; then
    echo "  Skip $site (missing $dir)"
    return
  fi
  echo "  chmod -R o+rX $dir"
  chmod -R o+rX "$dir"
}

if [[ -z "$TARGET" ]]; then
  echo "==> Fixing uploads permissions for all sites"
  for dir in "$ROOT"/sites/*/; do
    [[ -d "$dir" ]] || continue
    site="$(basename "$dir")"
    # Skip backup folders (*.bak-*)
    [[ "$site" == *.bak-* ]] && continue
    fix_one "$site"
  done
else
  echo "==> Fixing uploads permissions for site: $TARGET"
  fix_one "$TARGET"
fi

# ── Step 3: reload nginx ───────────────────────────────────────────────────────
echo "==> nginx -t && systemctl reload nginx"
nginx -t
systemctl reload nginx
echo "nginx reloaded OK."

# ── Step 4: optional smoke-test ───────────────────────────────────────────────
if [[ -n "$CHECK_URL" ]]; then
  echo
  echo "==> Smoke test: curl -I $CHECK_URL"
  curl -I "$CHECK_URL"
fi

echo
echo "Done. Uploads are publicly readable for nginx."
