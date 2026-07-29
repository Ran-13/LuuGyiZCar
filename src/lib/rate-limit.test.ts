import { afterEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, getClientKey } from "./rate-limit";

/** Unique per test so the module-scoped window map never leaks between cases. */
let counter = 0;
const freshKey = () => `test-key-${counter++}`;

describe("checkRateLimit", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the limit", () => {
    const key = freshKey();
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true);
    }
  });

  it("blocks once the limit is exceeded", () => {
    const key = freshKey();
    for (let i = 0; i < 3; i++) checkRateLimit(key, 3, 60_000);

    const result = checkRateLimit(key, 3, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("counts down remaining", () => {
    const key = freshKey();
    expect(checkRateLimit(key, 5, 60_000).remaining).toBe(4);
    expect(checkRateLimit(key, 5, 60_000).remaining).toBe(3);
  });

  it("tracks each key independently", () => {
    const a = freshKey();
    const b = freshKey();
    checkRateLimit(a, 1, 60_000);

    expect(checkRateLimit(a, 1, 60_000).allowed).toBe(false);
    expect(checkRateLimit(b, 1, 60_000).allowed).toBe(true);
  });

  it("resets after the window elapses", () => {
    vi.useFakeTimers();
    const key = freshKey();

    checkRateLimit(key, 1, 60_000);
    expect(checkRateLimit(key, 1, 60_000).allowed).toBe(false);

    vi.advanceTimersByTime(60_001);
    expect(checkRateLimit(key, 1, 60_000).allowed).toBe(true);
  });
});

describe("getClientKey", () => {
  const originalTrust = process.env.TRUST_PROXY_HEADERS;

  afterEach(() => {
    process.env.TRUST_PROXY_HEADERS = originalTrust;
  });

  it("ignores X-Forwarded-For when proxy headers are not trusted", () => {
    // Otherwise a client forges a fresh IP per request and bypasses the limiter.
    process.env.TRUST_PROXY_HEADERS = "false";
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4" });

    expect(getClientKey(headers)).toBe("unknown");
  });

  it("uses the left-most X-Forwarded-For entry when trusted", () => {
    process.env.TRUST_PROXY_HEADERS = "true";
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1, 10.0.0.2" });

    expect(getClientKey(headers)).toBe("1.2.3.4");
  });

  it("falls back to X-Real-IP when trusted and no forwarded chain exists", () => {
    process.env.TRUST_PROXY_HEADERS = "true";
    const headers = new Headers({ "x-real-ip": "9.9.9.9" });

    expect(getClientKey(headers)).toBe("9.9.9.9");
  });

  it("falls back to a shared bucket when trusted but no headers are present", () => {
    process.env.TRUST_PROXY_HEADERS = "true";

    expect(getClientKey(new Headers())).toBe("unknown");
  });
});
