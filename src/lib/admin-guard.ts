import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";

/** Failed logins before a hard lockout. */
export const LOGIN_MAX_FAILURES = 5;
/** Lockout duration after too many failures. */
export const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
/** Soft rate limit on the login endpoint itself. */
export const LOGIN_RATE_LIMIT = 20;
export const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;

interface FailureState {
  count: number;
  lockedUntil: number;
}

const failures = new Map<string, FailureState>();

function sweep(now: number): void {
  for (const [key, state] of failures) {
    if (state.lockedUntil > 0 && state.lockedUntil <= now && state.count === 0) {
      failures.delete(key);
    } else if (state.lockedUntil > 0 && state.lockedUntil <= now) {
      // Lock expired — reset counter so a fresh attempt can proceed.
      failures.set(key, { count: 0, lockedUntil: 0 });
    }
  }
}

export function getLoginClientKey(headers: Headers): string {
  return `admin-login:${getClientKey(headers)}`;
}

export function getLockout(key: string): { locked: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  sweep(now);
  const state = failures.get(key);
  if (!state || state.lockedUntil <= now) {
    return { locked: false, retryAfterSeconds: 0 };
  }
  return {
    locked: true,
    retryAfterSeconds: Math.max(1, Math.ceil((state.lockedUntil - now) / 1000)),
  };
}

export function recordLoginFailure(key: string): { locked: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  sweep(now);
  const state = failures.get(key) ?? { count: 0, lockedUntil: 0 };
  state.count += 1;

  if (state.count >= LOGIN_MAX_FAILURES) {
    state.lockedUntil = now + LOGIN_LOCKOUT_MS;
    state.count = 0;
    failures.set(key, state);
    return {
      locked: true,
      retryAfterSeconds: Math.ceil(LOGIN_LOCKOUT_MS / 1000),
    };
  }

  failures.set(key, state);
  return { locked: false, retryAfterSeconds: 0 };
}

export function clearLoginFailures(key: string): void {
  failures.delete(key);
}

/** Constant-ish delay so attackers cannot use response timing as a signal. */
export async function loginDelay(): Promise<void> {
  const ms = 350 + Math.floor(Math.random() * 250);
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reject cross-site mutation attempts.
 * Browser same-origin fetch always sends Origin (or Sec-Fetch-Site).
 */
export function isTrustedAdminRequest(request: Request): boolean {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return true;
  }

  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site") return false;
  if (site === "same-origin" || site === "same-site" || site === "none") {
    // "none" covers non-browser / curl; still require Origin match when present.
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return false;
    } catch {
      return false;
    }
  } else if (method !== "GET" && method !== "HEAD") {
    // Mutating request with neither Origin nor a same-origin Sec-Fetch-Site.
    if (site !== "same-origin" && site !== "same-site") return false;
  }

  return true;
}

export async function requireAdminApi(
  request: Request,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  if (!isTrustedAdminRequest(request)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden", code: "ORIGIN" }, { status: 403 }),
    };
  }

  if (!(await isAdminAuthenticated())) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized", code: "AUTH" }, { status: 401 }),
    };
  }

  return { ok: true };
}

export function checkLoginRateLimit(key: string) {
  return checkRateLimit(key, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW_MS);
}
