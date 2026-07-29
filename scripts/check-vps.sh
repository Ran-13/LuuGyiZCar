#!/usr/bin/env bash
# Verify LuuGyi is isolated and other stacks are still running.
set -euo pipefail

echo "== Docker compose projects =="
docker compose ls 2>/dev/null || true
echo

echo "== Containers / ports =="
docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
echo

echo "== Host listeners (80/443/8080-8083) =="
ss -tlnp | grep -E ':80 |:443 |:8080|:8081|:8082|:8083' || true
echo

echo "== Nginx site files =="
ls -la /etc/nginx/sites-enabled/ 2>/dev/null || true
echo

echo "== Quick health (localhost) =="
curl -sI --max-time 5 http://127.0.0.1:8080 | head -2 || echo "8080 (TeleManager): down"
curl -sI --max-time 5 http://127.0.0.1:8081 | head -2 || echo "8081 (Youtube): down"
curl -sI --max-time 5 http://127.0.0.1:8082 | head -2 || echo "8082 (akogyivip): down"
curl -sI --max-time 5 http://127.0.0.1:8083 | head -2 || echo "8083 (luugyizcar): down"
echo

echo "== DNS =="
echo -n "akogyivip.site -> "; dig +short akogyivip.site A || true
echo -n "luugyizcar.site -> "; dig +short luugyizcar.site A || true
echo -n "this server IP -> "; curl -s --max-time 5 ifconfig.me || curl -s --max-time 5 icanhazip.com || true
echo
echo

echo "== Public HTTPS (5s timeout) =="
curl -sI --max-time 5 https://akogyivip.site | head -5 || echo "akogyivip.site HTTPS: FAIL (DNS or cert?)"
curl -sI --max-time 5 https://luugyizcar.site | head -5 || echo "luugyizcar.site HTTPS: FAIL (DNS or cert?)"
curl -sI --max-time 5 -H "Host: akogyivip.site" http://127.0.0.1/ | head -5 || echo "nginx Host akogyivip via :80 FAIL"
curl -sI --max-time 5 -H "Host: akogyivip.site" http://127.0.0.1:8082/ | head -3 || true
