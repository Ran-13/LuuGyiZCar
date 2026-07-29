"use client";

import { useEffect } from "react";
import "./globals.css";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Replaces the root layout when it is the layout itself that threw, so this
 * component must render its own <html> and <body> and cannot rely on Header,
 * Footer, or anything else from the normal tree.
 */
export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error("[global error]", error.digest ?? "", error);
  }, [error]);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full items-center justify-center bg-ink-950 px-4">
        <div className="text-center">
          <p className="text-5xl font-black text-brand-500">Oops</p>
          <h1 className="mt-3 text-xl font-bold text-ink-100">The site hit an unexpected error</h1>
          <p className="mt-2 text-sm text-ink-400">Reload the page to continue.</p>

          {error.digest && (
            <p className="mt-2 font-mono text-xs text-ink-600">Reference: {error.digest}</p>
          )}

          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-md bg-brand-500 px-5 py-2.5 text-sm font-bold text-black transition-colors hover:bg-brand-600"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
