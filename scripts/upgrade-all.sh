#!/usr/bin/env bash
# Upgrade EVERY LuuGyi site that has a sites/<name>/.env file.
# Usage: ./scripts/upgrade-all.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

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

for env in "${envs[@]}"; do
  name="$(basename "$(dirname "$env")")"
  echo
  echo "######## Upgrading $name ########"
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

echo
echo "All sites upgraded."
