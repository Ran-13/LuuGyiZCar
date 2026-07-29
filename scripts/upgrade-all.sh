#!/usr/bin/env bash
# Upgrade EVERY LuuGyi site that has a sites/<name>/.env file.
# Usage: ./scripts/upgrade-all.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=lib/nginx-cache.sh
. "$ROOT/scripts/lib/nginx-cache.sh"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "==> git pull once"
  git pull --ff-only || git pull
fi

shopt -s nullglob
envs=(sites/*/.env)
if [[ ${#envs[@]} -eq 0 ]]; then
  echo "No sites found under sites/*/.env"
  exit 1
fi

# Ensure nginx can traverse /root (once for all sites)
chmod o+x /root 2>/dev/null || true

for env in "${envs[@]}"; do
  name="$(basename "$(dirname "$env")")"
  echo
  echo "######## Upgrading $name ########"
  # Ensure nginx can read uploaded files
  chmod -R o+rX "$ROOT/sites/$name/uploads" 2>/dev/null || true
  # Skip git pull inside upgrade-site (already pulled)
  ROOT="$ROOT" bash -c "
    set -euo pipefail
    ENV_FILE='$ROOT/sites/$name/.env'
    set -a; source \"\$ENV_FILE\"; set +a
    PROJECT=\"\${COMPOSE_PROJECT_NAME:-luugyi-$name}\"
    cd '$ROOT'
    docker compose --env-file \"\$ENV_FILE\" -p \"\$PROJECT\" up -d --build
    echo Upgraded \$NEXT_PUBLIC_SITE_URL
  "
done

# One shared cache zone across every site, so purge once after the whole loop
# rather than per site.
echo
purge_nginx_cache

echo
echo "All sites upgraded."
