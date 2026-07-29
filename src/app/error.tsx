"use client";

import { useEffect } from "react";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: Props) {
  useEffect(() => {
    // The digest is the only handle on the server-side stack, which Next.js
    // withholds from the client in production.
    console.error("[error boundary]", error.digest ?? "", error);
  }, [error]);

  return (
    <div className="py-24 text-center">
      <p className="text-5xl font-black text-brand-500">Oops</p>
      <h1 className="mt-3 text-xl font-bold text-ink-100">Something went wrong</h1>
      <p className="mt-2 text-sm text-ink-400">
        This page failed to load. It is usually temporary — try again in a moment.
      </p>

      {error.digest && (
        <p className="mt-2 font-mono text-xs text-ink-600">Reference: {error.digest}</p>
      )}

      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-md bg-brand-500 px-5 py-2.5 text-sm font-bold text-black transition-colors hover:bg-brand-600"
      >
        Try again
      </button>
    </div>
  );
}
