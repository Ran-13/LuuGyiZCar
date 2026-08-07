import { NextResponse } from "next/server";
import { isAdminUiPath } from "@/lib/admin-path";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import {
  COOKIE_NAME,
  isBotUserAgent,
  newVisitorId,
  pruneOldDayFiles,
  recordPageView,
} from "@/lib/site-analytics";

export const dynamic = "force-dynamic";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * Public pageview beacon. Sets an anonymous visitor cookie and records
 * page views / DAU / new users into data/analytics/.
 */
export async function POST(request: Request) {
  const ua = request.headers.get("user-agent");
  if (isBotUserAgent(ua)) {
    return NextResponse.json({ ok: true, skipped: "bot" });
  }

  const limit = checkRateLimit(`analytics:${getClientKey(request.headers)}`, 120, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let body: { path?: string };
  try {
    body = (await request.json()) as { path?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const pathName = typeof body.path === "string" ? body.path : "/";
  if (isAdminUiPath(pathName)) {
    return NextResponse.json({ ok: true, skipped: "admin" });
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const existing = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  let visitorId = existing?.slice(COOKIE_NAME.length + 1)?.trim() ?? "";
  let setCookie = false;
  if (!visitorId || visitorId.length < 8 || visitorId.length > 80) {
    visitorId = newVisitorId();
    setCookie = true;
  }

  const result = await recordPageView({
    visitorId,
    path: pathName,
    isAdminPath: false,
  });

  // Cheap maintenance — only sometimes
  if (Math.random() < 0.01) {
    void pruneOldDayFiles();
  }

  const res = NextResponse.json({ ok: result.ok, isNew: result.isNew });
  if (setCookie) {
    res.cookies.set(COOKIE_NAME, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
  }
  return res;
}
