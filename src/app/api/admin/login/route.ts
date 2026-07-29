import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  assertCredentialsConfigured,
  createSessionToken,
  credentialsMatch,
  sessionCookieOptions,
} from "@/lib/admin-auth";
import {
  checkLoginRateLimit,
  clearLoginFailures,
  getLockout,
  getLoginClientKey,
  isTrustedAdminRequest,
  loginDelay,
  recordLoginFailure,
} from "@/lib/admin-guard";

function unauthorized(retryAfterSeconds = 0) {
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
  };
  if (retryAfterSeconds > 0) {
    headers["Retry-After"] = String(retryAfterSeconds);
  }
  // Generic message — do not reveal whether username or password was wrong.
  return NextResponse.json(
    {
      error: "Invalid credentials",
      code: "INVALID_CREDENTIALS",
      ...(retryAfterSeconds > 0 ? { retryAfterSeconds } : {}),
    },
    { status: 401, headers },
  );
}

export async function POST(request: Request) {
  if (!isTrustedAdminRequest(request)) {
    return NextResponse.json({ error: "Forbidden", code: "ORIGIN" }, { status: 403 });
  }

  const configured = assertCredentialsConfigured();
  if (!configured.ok) {
    return NextResponse.json(
      { error: configured.reason, code: "MISCONFIGURED" },
      { status: 503 },
    );
  }

  const clientKey = getLoginClientKey(request.headers);

  const lock = getLockout(clientKey);
  if (lock.locked) {
    await loginDelay();
    return NextResponse.json(
      {
        error: "Too many failed attempts. Try again later.",
        code: "LOCKED",
        retryAfterSeconds: lock.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(lock.retryAfterSeconds),
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const rate = checkLoginRateLimit(clientKey);
  if (!rate.allowed) {
    await loginDelay();
    return NextResponse.json(
      {
        error: "Too many requests. Try again later.",
        code: "RATE_LIMITED",
        retryAfterSeconds: rate.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfterSeconds),
          "Cache-Control": "no-store",
        },
      },
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = (await request.json()) as { username?: string; password?: string };
  } catch {
    await loginDelay();
    return NextResponse.json({ error: "Invalid request", code: "BAD_REQUEST" }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";

  // Hard caps to avoid huge payload hashing.
  if (username.length > 128 || password.length > 256) {
    await loginDelay();
    return unauthorized();
  }

  const ok = credentialsMatch(username, password);
  if (!ok) {
    const fail = recordLoginFailure(clientKey);
    await loginDelay();
    if (fail.locked) {
      return NextResponse.json(
        {
          error: "Too many failed attempts. Try again later.",
          code: "LOCKED",
          retryAfterSeconds: fail.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(fail.retryAfterSeconds),
            "Cache-Control": "no-store",
          },
        },
      );
    }
    return unauthorized();
  }

  clearLoginFailures(clientKey);

  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set(ADMIN_COOKIE, createSessionToken(), sessionCookieOptions(60 * 60 * 12));
  return response;
}

export async function DELETE(request: Request) {
  if (!isTrustedAdminRequest(request)) {
    return NextResponse.json({ error: "Forbidden", code: "ORIGIN" }, { status: 403 });
  }

  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set(ADMIN_COOKIE, "", sessionCookieOptions(0));
  return response;
}
