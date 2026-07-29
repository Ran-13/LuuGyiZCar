# LuuGyi Zcar

Video browsing site built on Next.js 16 (App Router) and Tailwind v4, backed by the
public Eporner API v2.

## Getting started

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SITE_URL` before building for
production — canonical URLs, the sitemap, and Open Graph images are all derived from it.

## Scripts

| Command         | Purpose                       |
| --------------- | ----------------------------- |
| `npm run dev`   | Dev server                    |
| `npm run build` | Production build (standalone) |
| `npm start`     | Serve a production build      |
| `npm test`      | Unit tests (Vitest)           |
| `npm run lint`  | ESLint                        |

## Architecture notes

- **All upstream calls are server-side.** The Eporner API sends no CORS headers, so the
  browser cannot call it directly. Infinite scroll pages through `/api/videos`, an
  internal proxy.
- **`/api/videos` is guarded**, since an open proxy is free upstream quota for anyone who
  finds it — and the upstream throttles by IP. It requires `Sec-Fetch-Site: same-origin`
  and rate-limits per client (60 req/min). The limiter is in-process; running multiple
  replicas multiplies the effective limit, which is the point to move it to Redis
  (`src/lib/rate-limit.ts`).
- **Titles are mojibake-corrected.** The API returns UTF-8 bytes re-encoded as Latin-1
  codepoints, so non-Latin titles arrive garbled. `decodeMojibake` in `src/lib/eporner.ts`
  reverses this and bails out on anything that is not a clean round-trip.
- **`total_count` is inconsistent** (string on some queries, number on others) and the API
  stops serving past 100,000 results, so pagination is recomputed and clamped rather than
  trusted.
- **Favorites and history are localStorage-only.** Entries store a trimmed video snapshot
  rather than an id, because the upstream `id` endpoint accepts one id per request —
  rehydrating a saved list by id would mean one upstream call per entry.
- **Storage keys live in `src/lib/storage-keys.ts`**, deliberately outside the
  `"use client"` module. A server component importing a value from a client module gets a
  client reference, not the value, which silently becomes `undefined` when passed as a prop.

## Deployment

Build the container:

```bash
docker build --build-arg NEXT_PUBLIC_SITE_URL=https://your-domain.com -t luugyi-zcar .
```

Run it:

```bash
docker run -p 3000:3000 -e TRUST_PROXY_HEADERS=true luugyi-zcar
```

Set `TRUST_PROXY_HEADERS=true` only when running behind a reverse proxy that overwrites
`X-Forwarded-For`. When it is unset, the rate limiter ignores the header, because a client
can otherwise forge a fresh IP per request and bypass the limit entirely.

`next/image` optimizes remote CDN thumbnails, which is CPU-bound on a small VPS. If load
becomes a problem, reduce `imageSizes` / `deviceSizes` in `next.config.ts`.
