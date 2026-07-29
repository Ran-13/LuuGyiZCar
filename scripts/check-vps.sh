#!/usr/bin/env bash
# Verify LuuGyi is isolated and other stacks are still running.
set -euo pipefail

echo "== Docker compose projects =="
docker compose ls 2>/dev/null || true
echo

echo "== Containers / ports =="
docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
echo

echo "== Host listeners (80/443/8080-8082) =="
ss -tlnp | grep -E ':80 |:443 |:8080|:8081|:8082' || true
echo

echo "== Nginx site files =="
ls -la /etc/nginx/sites-enabled/ 2>/dev/null || true
echo

echo "== Quick health =="
curl -sI http://127.0.0.1:8080 | head -2 || echo "8080 (TeleManager): down/unreachable"
curl -sI http://127.0.0.1:8081 | head -2 || echo "8081 (Youtube): down/unreachable"
curl -sI http://127.0.0.1:8082 | head -2 || echo "8082 (LuuGyi): down/unreachable"
