#!/usr/bin/env bash
# Shared nginx proxy-cache helpers.
#
# Source it, do not execute:
#   . "$ROOT/scripts/lib/nginx-cache.sh"
#
# Why this exists: every rebuild produces a new Next.js build id, so all
# /_next/static chunks get new hashed URLs. nginx keeps serving HTML cached from
# the previous build for up to proxy_cache_valid (60s), and that HTML references
# chunk files the new container no longer has — visitors get chunk-load errors
# or a stale UI. Any script that rebuilds a container must purge afterwards.

# All LuuGyi sites share ONE cache zone (keys_zone=luugyi_cache), so a purge is
# global. Scripts that loop over many sites should call this once at the end,
# not per site.
NGINX_CACHE_DIR="${NGINX_CACHE_DIR:-/var/cache/nginx/luugyi}"

purge_nginx_cache() {
  if [[ ! -d "$NGINX_CACHE_DIR" ]]; then
    echo "==> No nginx cache dir at $NGINX_CACHE_DIR (skipping purge)"
    return 0
  fi

  echo "==> Purging nginx proxy cache ($NGINX_CACHE_DIR)"
  # Delete contents, keep the directory itself — nginx holds it open and would
  # need a full restart (not a reload) if the directory vanished.
  find "$NGINX_CACHE_DIR" -mindepth 1 -delete 2>/dev/null \
    || rm -rf "${NGINX_CACHE_DIR:?}"/* 2>/dev/null \
    || true

  if command -v nginx >/dev/null 2>&1; then
    if nginx -t >/dev/null 2>&1; then
      systemctl reload nginx 2>/dev/null || nginx -s reload 2>/dev/null || true
    else
      echo "    ! nginx -t failed — cache cleared but nginx NOT reloaded."
      echo "      Run 'nginx -t' to see the error."
    fi
  fi

  echo "    Cache cleared — visitors get the new build immediately."
}
