"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { adminApiUrl } from "@/lib/admin-path";

export default function AdminLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(adminApiUrl("/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username, password }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        retryAfterSeconds?: number;
      };

      if (res.status === 429) {
        const wait = data.retryAfterSeconds
          ? ` Wait about ${Math.ceil(data.retryAfterSeconds / 60)} min.`
          : "";
        setError((data.error || "Too many attempts.") + wait);
        return;
      }

      if (!res.ok) {
        setError(data.error || "Invalid credentials");
        return;
      }

      setPassword("");
      router.refresh();
    } catch {
      setError("Login failed. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      autoComplete="on"
      className="mx-auto mt-16 w-full max-w-sm rounded-lg border border-ink-700 bg-ink-900 p-6"
    >
      <h1 className="text-lg font-bold text-ink-100">Admin login</h1>
      <p className="mt-1 text-sm text-ink-400">Protected panel — authorized access only.</p>

      <label className="mt-5 block text-sm text-ink-300">
        Username
        <input
          type="text"
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          required
          maxLength={128}
          className="mt-1.5 w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-ink-100 outline-none focus:border-brand-500"
        />
      </label>

      <label className="mt-4 block text-sm text-ink-300">
        Password
        <input
          type="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          maxLength={256}
          className="mt-1.5 w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-ink-100 outline-none focus:border-brand-500"
        />
      </label>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-5 w-full rounded-md bg-brand-500 px-4 py-2.5 text-sm font-bold text-black transition-colors hover:bg-brand-400 disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
