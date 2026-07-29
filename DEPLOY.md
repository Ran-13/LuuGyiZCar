# LuuGyi Zcar — Production Deployment Guide

Two sites on the same VPS, isolated from TeleManager and Youtube.

| Site | Domain | Docker port | Nginx file |
|------|--------|-------------|------------|
| **akogyivip** | https://akogyivip.site | `127.0.0.1:8082` | `luugyi-akogyivip` |
| **luugyizcar** | https://luugyizcar.site | `127.0.0.1:8083` | `luugyi-luugyizcar` |

Existing apps (do not change):

| App | Port |
|-----|------|
| TeleManager | `127.0.0.1:8080` |
| Youtube Live Streaming | `127.0.0.1:8081` |

Each LuuGyi site has its own admin panel URL, password, ads config, and uploaded banners.

---

## 0. DNS (do this first)

At your domain registrar, create **A** records for both domains pointing to your VPS public IP:

```
akogyivip.site        A    YOUR_VPS_IP
www.akogyivip.site    A    YOUR_VPS_IP
luugyizcar.site       A    YOUR_VPS_IP
www.luugyizcar.site   A    YOUR_VPS_IP
```

Wait until they resolve:

```bash
dig +short akogyivip.site
dig +short luugyizcar.site
```

---

## 1. Clone on the VPS

SSH as root (or a user with Docker + sudo):

```bash
cd ~
git clone https://github.com/Ran-13/LuuGyiZCar.git
cd LuuGyiZCar
chmod +x scripts/*.sh
```

Do **not** put this inside `~/TeleManager` or `~/YoutubeLiveStreaming`.

---

## 2. Deploy both sites

```bash
cd ~/LuuGyiZCar

# Site 1 — akogyivip.site → port 8082
./scripts/add-domain.sh akogyivip akogyivip.site 8082

# Site 2 — luugyizcar.site → port 8083
./scripts/add-domain.sh luugyizcar luugyizcar.site 8083
```

Each command will:

1. Create `sites/<name>/.env` with strong random admin secrets  
2. Build & start a Docker container on localhost only  
3. Add a **new** nginx site file (does not edit TeleManager / Youtube configs)  
4. Request HTTPS via Certbot  
5. Print **Admin URL, username, password** — save these somewhere safe  

If a site folder already exists, the script stops safely. To recreate, remove only that site’s folder after `down` (see §6).

---

## 3. Verify nothing else broke

```bash
./scripts/check-vps.sh
```

Expected:

- `telemanager_*` still on `8080`
- `youtubelivestreaming-*` still on `8081`
- LuuGyi containers on `8082` and `8083`
- https://akogyivip.site and https://luugyizcar.site load

Also:

```bash
docker compose ls
curl -sI http://127.0.0.1:8082 | head -2
curl -sI http://127.0.0.1:8083 | head -2
```

---

## 4. Admin panels

After deploy, open the URLs printed by the script, for example:

- `https://akogyivip.site/<secret-slug>`
- `https://luugyizcar.site/<secret-slug>`

Secrets live in:

- `~/LuuGyiZCar/sites/akogyivip/.env`
- `~/LuuGyiZCar/sites/luugyizcar/.env`

```bash
# Show admin path + user (not password) for a site
grep -E 'NEXT_PUBLIC_SITE_URL|ADMIN_PATH|ADMIN_USERNAME' sites/akogyivip/.env
```

In each admin panel you can:

- Edit VIP dialog + home ads text  
- Upload GIF banners (home top / bottom, video mid)  
- Enable/disable placements  

Plain `/admin` returns **404** when a secret slug is set.

---

## 5. Upgrade to a new code version

On your Mac: commit + push to GitHub.

On the VPS:

```bash
cd ~/LuuGyiZCar

# One site
./scripts/upgrade-site.sh akogyivip
./scripts/upgrade-site.sh luugyizcar

# Or both
./scripts/upgrade-all.sh
```

Preserved across upgrades:

- `sites/*/data/ads.json` (announcements & banner URLs)  
- `sites/*/uploads/` (GIF files)  
- `sites/*/.env` (passwords & secret admin paths)  

---

## 6. Stop / restart / remove one site

```bash
cd ~/LuuGyiZCar

# Stop only akogyivip (others keep running)
docker compose --env-file sites/akogyivip/.env -p luugyi-akogyivip down

# Start again
./scripts/upgrade-site.sh akogyivip

# Full remove of one site (careful — deletes that site's env if you rm the folder)
docker compose --env-file sites/akogyivip/.env -p luugyi-akogyivip down
rm -f /etc/nginx/sites-enabled/luugyi-akogyivip
rm -f /etc/nginx/sites-available/luugyi-akogyivip
nginx -t && systemctl reload nginx
# optional: rm -rf sites/akogyivip
```

Never run a blind `docker compose down` without `-p` and `--env-file` from the wrong folder — always target `luugyi-*` project names.

---

## 7. Add a third domain later

```bash
./scripts/add-domain.sh newsite  another-domain.com  8084
```

Use the next free port (`8084`, `8085`, …).

---

## 8. Manual nginx (if Certbot / script skipped)

Template: `deploy/nginx-luugyi-zcar.conf`

```bash
# akogyivip → 8082
sed 's/YOUR-DOMAIN.com/akogyivip.site/g; s/8082/8082/g' deploy/nginx-luugyi-zcar.conf \
  | tee /etc/nginx/sites-available/luugyi-akogyivip
ln -sfn /etc/nginx/sites-available/luugyi-akogyivip /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d akogyivip.site -d www.akogyivip.site

# luugyizcar → 8083
sed 's/YOUR-DOMAIN.com/luugyizcar.site/g; s/8082/8083/g' deploy/nginx-luugyi-zcar.conf \
  | tee /etc/nginx/sites-available/luugyi-luugyizcar
ln -sfn /etc/nginx/sites-available/luugyi-luugyizcar /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d luugyizcar.site -d www.luugyizcar.site
```

---

## 9. Troubleshooting

| Problem | Check |
|---------|--------|
| 502 Bad Gateway | `docker compose -p luugyi-akogyivip ps` and `logs` |
| Certbot fails | DNS not pointing yet; retry certbot after dig works |
| Wrong site content | Confirm ports: akogyivip=8082, luugyizcar=8083 |
| Admin 404 at `/admin` | Use secret slug from `.env` (`ADMIN_PATH`) |
| Can’t upload GIF | Volume writable; max 5MB; gif/jpg/png/webp |
| Locked out of admin | Wait 15 min after 5 failed logins, or clear lock by restarting that container |

```bash
docker compose -p luugyi-akogyivip logs --tail=100
docker compose -p luugyi-luugyizcar logs --tail=100
```

---

## Quick command cheat sheet

```bash
cd ~/LuuGyiZCar

# First-time both sites
./scripts/add-domain.sh akogyivip  akogyivip.site  8082
./scripts/add-domain.sh luugyizcar luugyizcar.site 8083

# Health
./scripts/check-vps.sh

# Upgrade after git push
git pull
./scripts/upgrade-all.sh
```
