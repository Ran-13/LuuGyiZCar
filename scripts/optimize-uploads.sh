#!/usr/bin/env bash
# Optimize existing uploaded GIF banners by converting to WebP.
# Keeps originals as *.gif.bak. Updates ads.json references.
#
# Requires: cwebp (from webp package) OR runs inside Docker with sharp.
#
# Usage:
#   ./scripts/optimize-uploads.sh                # all sites
#   ./scripts/optimize-uploads.sh akogyivip      # one site
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-}"

# Check for cwebp (apt install webp)
if ! command -v cwebp >/dev/null 2>&1; then
  echo "Installing webp tools..."
  apt-get update -qq && apt-get install -y -qq webp >/dev/null 2>&1 || {
    echo "ERROR: Could not install 'webp' package. Run: apt install webp"
    exit 1
  }
fi

optimize_site() {
  local site="$1"
  local uploads="$ROOT/sites/$site/uploads/ads"
  local json="$ROOT/sites/$site/data/ads.json"

  if [[ ! -d "$uploads" ]]; then
    echo "Skip $site (no uploads dir)"
    return
  fi

  local count=0
  for gif in "$uploads"/*.gif; do
    [[ -f "$gif" ]] || continue

    local base
    base="$(basename "$gif" .gif)"
    local webp="$uploads/${base}.webp"

    if [[ -f "$webp" ]]; then
      echo "  Already converted: ${base}.webp"
      continue
    fi

    local before_kb
    before_kb=$(( $(stat -c%s "$gif" 2>/dev/null || stat -f%z "$gif") / 1024 ))

    echo -n "  Converting $base.gif (${before_kb}KB) → "

    # gif2webp handles animated GIFs better than cwebp
    if command -v gif2webp >/dev/null 2>&1; then
      gif2webp -q 75 -m 4 "$gif" -o "$webp" 2>/dev/null
    else
      cwebp -q 75 "$gif" -o "$webp" 2>/dev/null
    fi

    if [[ -f "$webp" ]]; then
      local after_kb
      after_kb=$(( $(stat -c%s "$webp" 2>/dev/null || stat -f%z "$webp") / 1024 ))
      echo "${after_kb}KB ($(( 100 - after_kb * 100 / before_kb ))% smaller)"

      # Backup original
      mv "$gif" "${gif}.bak"

      # Update ads.json references
      if [[ -f "$json" ]]; then
        sed -i "s|${base}.gif|${base}.webp|g" "$json"
      fi

      count=$((count + 1))
    else
      echo "FAILED"
    fi
  done

  if [[ $count -eq 0 ]]; then
    echo "  No GIFs to convert for $site"
  else
    echo "  Converted $count files for $site"
  fi
}

if [[ -z "$TARGET" ]]; then
  echo "==> Optimizing uploads for all sites"
  for dir in "$ROOT"/sites/*/; do
    [[ -d "$dir" ]] || continue
    site="$(basename "$dir")"
    [[ "$site" == *.bak-* ]] && continue
    echo "Site: $site"
    optimize_site "$site"
  done
else
  echo "==> Optimizing uploads for: $TARGET"
  optimize_site "$TARGET"
fi

echo
echo "Done. Re-upload any banners from admin panel to use sharp-optimized WebP."
echo "Or restart the app so ads.json picks up the new .webp references."
