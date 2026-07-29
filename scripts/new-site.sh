#!/usr/bin/env bash
# Scaffold a new isolated site (env + data + uploads).
# Usage: ./scripts/new-site.sh mysite 3002
set -euo pipefail

NAME="${1:-}"
PORT="${2:-}"
if [[ -z "$NAME" || -z "$PORT" ]]; then
  echo "Usage: $0 <site-name> <host-port>"
  echo "Example: $0 site3 3002"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/sites/$NAME"

if [[ -d "$DIR" ]]; then
  echo "Already exists: $DIR"
  exit 1
fi

SLUG="$(openssl rand -base64 9 | tr -d '/+=' | tr '[:upper:]' '[:lower:]' | head -c 12)"
PASS="$(openssl rand -base64 24 | tr -d '/+=')"
SECRET="$(openssl rand -base64 32 | tr -d '/+=')"
USER="admin-$(openssl rand -hex 3)"

mkdir -p "$DIR/data" "$DIR/uploads/ads"
cp "$ROOT/data/ads.json" "$DIR/data/ads.json" 2>/dev/null || true
touch "$DIR/uploads/ads/.gitkeep"

if command -v chown >/dev/null 2>&1; then
  chown -R 1001:1001 "$DIR/data" "$DIR/uploads" 2>/dev/null || true
fi

cat > "$DIR/.env" <<EOF
COMPOSE_PROJECT_NAME=luugyi-$NAME
HOST_BIND=0.0.0.0
HOST_PORT=$PORT

DATA_DIR=./sites/$NAME/data
UPLOADS_DIR=./sites/$NAME/uploads

NEXT_PUBLIC_SITE_URL=http://localhost:$PORT
ADMIN_PATH=$SLUG
NEXT_PUBLIC_ADMIN_PATH=$SLUG

ADMIN_USERNAME=$USER
ADMIN_PASSWORD=$PASS
ADMIN_SECRET=$SECRET

TRUST_PROXY_HEADERS=false
EOF

cp "$DIR/.env" "$DIR/.env.example"
# Scrub secrets in the committed example
sed -i.bak \
  -e "s/^ADMIN_PASSWORD=.*/ADMIN_PASSWORD=replace-me/" \
  -e "s/^ADMIN_SECRET=.*/ADMIN_SECRET=replace-me/" \
  -e "s/^ADMIN_USERNAME=.*/ADMIN_USERNAME=replace-me/" \
  "$DIR/.env.example" && rm -f "$DIR/.env.example.bak"

echo "Created sites/$NAME"
echo "  URL:   http://localhost:$PORT"
echo "  Admin: http://localhost:$PORT/$SLUG"
echo "  User:  $USER"
echo "  Pass:  $PASS"
echo
echo "Start: ./scripts/up-site.sh $NAME"
