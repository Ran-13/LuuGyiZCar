/**
 * Fixed-window, in-process rate limiter.
 *
 * Deliberately dependency-free: this app runs as a single container on a VPS,
 * where a module-scoped Map is sufficient. The state is per-process, so running
 * multiple replicas multiplies the effective limit — that is the point at which
 * this should be swapped for Redis. Keep the swap confined to `checkRateLimit`.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Requests still available in the current window. */
  remaining: number;
  /** Seconds until the window resets — used for the Retry-After header. */
  retryAfterSeconds: number;
}

interface Window {
  count: number;
  /** Epoch ms at which this window expires. */
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Bounds memory growth from one-off IPs without needing a background timer. */
function sweepExpired(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    // Sweeping on window creation keeps the cost proportional to new clients
    // rather than running on every single request.
    sweepExpired(now);
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

  if (existing.count > limit) {
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  return { allowed: true, remaining: limit - existing.count, retryAfterSeconds };
}

/**
 * Best-effort client IP.
 *
 * X-Forwarded-For is only honoured when TRUST_PROXY_HEADERS is set, because any
 * client can forge it — trusting it unconditionally would make the limiter
 * trivially bypassable by sending a random IP per request.
 */
export function getClientKey(headers: Headers): string {
  if (process.env.TRUST_PROXY_HEADERS === "true") {
    const forwarded = headers.get("x-forwarded-for");
    // Left-most entry is the original client; the rest are proxy hops.
    const clientIp = forwarded?.split(",")[0]?.trim();
    if (clientIp) return clientIp;

    const realIp = headers.get("x-real-ip")?.trim();
    if (realIp) return realIp;
  }

  // No trustworthy per-client signal: fall back to a shared bucket, which still
  // caps total upstream load even if it cannot isolate individual abusers.
  return "unknown";
}
