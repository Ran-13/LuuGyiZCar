import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-lz_admin" : "lz_admin_session";

/** Session lifetime — short enough to limit stolen-cookie window. */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const WEAK_PASSWORDS = new Set([
  "change-me",
  "password",
  "admin",
  "admin123",
  "123456",
  "12345678",
  "qwerty",
  "letmein",
]);

function signingSecret(): string {
  const secret = process.env.ADMIN_SECRET?.trim();
  if (secret && secret.length >= 16) return secret;

  const password = process.env.ADMIN_PASSWORD?.trim();
  if (password && password.length >= 16) return `pwd:${password}`;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "ADMIN_SECRET (min 16 chars) or a long ADMIN_PASSWORD must be set in production",
    );
  }
  return "dev-only-admin-secret";
}

export function getAdminUsername(): string {
  return (process.env.ADMIN_USERNAME || "admin").trim();
}

export function getAdminPassword(): string {
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!password) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ADMIN_PASSWORD must be set in production");
    }
    return "change-me";
  }
  return password;
}

/** Reject trivially guessable credentials before issuing a session. */
export function assertCredentialsConfigured(): { ok: true } | { ok: false; reason: string } {
  try {
    const password = getAdminPassword();
    const username = getAdminUsername();

    if (process.env.NODE_ENV === "production") {
      if (password.length < 12) {
        return { ok: false, reason: "Server misconfigured" };
      }
      if (WEAK_PASSWORDS.has(password.toLowerCase())) {
        return { ok: false, reason: "Server misconfigured" };
      }
      if (!process.env.ADMIN_SECRET || process.env.ADMIN_SECRET.trim().length < 16) {
        return { ok: false, reason: "Server misconfigured" };
      }
      if (username.toLowerCase() === "admin" && password.length < 16) {
        return { ok: false, reason: "Server misconfigured" };
      }
    }

    return { ok: true };
  } catch {
    return { ok: false, reason: "Server misconfigured" };
  }
}

function sign(payload: string): string {
  return createHmac("sha256", signingSecret()).update(payload).digest("hex");
}

/** Expensive KDF so offline/brute attempts against a stolen compare are slow. */
function deriveKey(value: string, purpose: string): Buffer {
  const salt = createHmac("sha256", signingSecret()).update(purpose).digest();
  return scryptSync(value, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

function safeEqualBuffers(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

let cachedPasswordHash: Buffer | null = null;

function expectedPasswordHash(): Buffer {
  if (!cachedPasswordHash) {
    cachedPasswordHash = deriveKey(getAdminPassword(), "admin-password-v1");
  }
  return cachedPasswordHash;
}

export function credentialsMatch(username: string, password: string): boolean {
  const userOk = safeEqualBuffers(
    deriveKey(username.trim(), "admin-username-v1"),
    deriveKey(getAdminUsername(), "admin-username-v1"),
  );
  const passOk = safeEqualBuffers(deriveKey(password, "admin-password-v1"), expectedPasswordHash());
  // Always evaluate both; combine without short-circuit.
  return userOk && passOk;
}

export function createSessionToken(): string {
  const sid = randomBytes(24).toString("base64url");
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = `v1.${sid}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 4) return false;
  const [version, sid, expStr, sig] = parts;
  if (version !== "v1" || !sid || sid.length < 16) return false;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;

  const payload = `${version}.${sid}.${expStr}`;
  const expected = sign(payload);
  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  return verifySessionToken(jar.get(ADMIN_COOKIE)?.value);
}

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
