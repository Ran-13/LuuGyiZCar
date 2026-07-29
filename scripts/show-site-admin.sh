#!/usr/bin/env bash
# Show the current admin credentials for one deployed site.
# Reads sites/<name>/.env and prints the site URL, admin URL, username, and password.
#
# Usage:
#   ./scripts/show-site-admin.sh akogyivip
#   ./scripts/show-site-admin.sh luugyizcar
set -euo pipefail

SITE="${1:-}"
if [[ -z "$SITE" ]]; then
  echo "Usage: $0 <site-name>"
  echo "Available sites:"
  ls -1 sites 2>/dev/null | sed 's/^/  - /' || true
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/sites/$SITE/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  echo "This site has not been deployed yet, or the env file is gone."
  exit 1
fi

# shellcheck disable=SC1090
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

SITE_URL="${NEXT_PUBLIC_SITE_URL:-}"
ADMIN_PATH="${NEXT_PUBLIC_ADMIN_PATH:-${ADMIN_PATH:-admin}}"
ADMIN_URL="${SITE_URL%/}/${ADMIN_PATH}"

echo "=============================================="
echo "  Site:      $SITE"
echo "  URL:       ${SITE_URL}"
echo "  Admin URL: ${ADMIN_URL}"
echo "  Username:  ${ADMIN_USERNAME:-<missing>}"
echo "  Password:  ${ADMIN_PASSWORD:-<missing>}"
echo "  Env file:  $ENV_FILE"
echo "=============================================="
