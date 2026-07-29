#!/usr/bin/env bash
# Fix mounted volume permissions so admin panel saves/uploads work.
# The app runs as uid/gid 1001 inside Docker.
#
# Usage:
#   ./scripts/fix-site-perms.sh akogyivip
#   ./scripts/fix-site-perms.sh luugyizcar
#   ./scripts/fix-site-perms.sh --all
set -euo pipefail

TARGET="${1:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

fix_one() {
  local site="$1"
  local dir="$ROOT/sites/$site"
  if [[ ! -d "$dir" ]]; then
    echo "Skip $site (missing $dir)"
    return
  fi

  mkdir -p "$dir/data" "$dir/uploads/ads"
  chown -R 1001:1001 "$dir/data" "$dir/uploads"
  chmod -R u+rwX "$dir/data" "$dir/uploads"
  echo "Fixed permissions for $site"
}

if [[ "$TARGET" == "--all" ]]; then
  for dir in "$ROOT"/sites/*; do
    [[ -d "$dir" ]] || continue
    fix_one "$(basename "$dir")"
  done
  exit 0
fi

if [[ -z "$TARGET" ]]; then
  echo "Usage: $0 <site-name> | --all"
  exit 1
fi

fix_one "$TARGET"
