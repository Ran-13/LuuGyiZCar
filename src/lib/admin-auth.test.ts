import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  credentialsMatch,
  verifySessionToken,
} from "./admin-auth";
import {
  clearLoginFailures,
  getLockout,
  isTrustedAdminRequest,
  recordLoginFailure,
} from "./admin-guard";

describe("admin session tokens", () => {
  it("round-trips a valid session", () => {
    const token = createSessionToken();
    expect(verifySessionToken(token)).toBe(true);
  });

  it("rejects tampered tokens", () => {
    const token = createSessionToken();
    const parts = token.split(".");
    parts[1] = "tampered-session-id-xxxxx";
    expect(verifySessionToken(parts.join("."))).toBe(false);
  });

  it("rejects empty / garbage", () => {
    expect(verifySessionToken("")).toBe(false);
    expect(verifySessionToken("a.b.c")).toBe(false);
    expect(verifySessionToken(null)).toBe(false);
  });
});

describe("credentialsMatch", () => {
  it("accepts configured username and password", () => {
    // Defaults in test/dev: admin / change-me
    expect(credentialsMatch("admin", "change-me")).toBe(true);
  });

  it("rejects wrong password without leaking which field failed", () => {
    expect(credentialsMatch("admin", "wrong-password")).toBe(false);
    expect(credentialsMatch("nope", "change-me")).toBe(false);
  });
});

describe("login lockout", () => {
  it("locks after repeated failures", () => {
    const key = `test-lock-${Math.random()}`;
    clearLoginFailures(key);

    for (let i = 0; i < 4; i++) {
      const r = recordLoginFailure(key);
      expect(r.locked).toBe(false);
    }
    const locked = recordLoginFailure(key);
    expect(locked.locked).toBe(true);
    expect(getLockout(key).locked).toBe(true);

    clearLoginFailures(key);
    expect(getLockout(key).locked).toBe(false);
  });
});

describe("isTrustedAdminRequest", () => {
  it("allows same-origin mutations", () => {
    const req = new Request("http://localhost/api/admin/login", {
      method: "POST",
      headers: {
        origin: "http://localhost",
        host: "localhost",
        "sec-fetch-site": "same-origin",
      },
    });
    expect(isTrustedAdminRequest(req)).toBe(true);
  });

  it("blocks cross-site mutations", () => {
    const req = new Request("http://localhost/api/admin/login", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        host: "localhost",
        "sec-fetch-site": "cross-site",
      },
    });
    expect(isTrustedAdminRequest(req)).toBe(false);
  });
});
