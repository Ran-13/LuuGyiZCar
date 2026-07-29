"use client";

import { Check, Share2 } from "lucide-react";
import { useCallback, useState } from "react";

interface Props {
  /** Absolute URL of the video page to share. */
  url: string;
  /** Video title used by the native share sheet. */
  title: string;
}

/**
 * Share the current video.
 * Prefers the Web Share API (phones / some desktops), falls back to
 * copying the link into the clipboard.
 */
export default function ShareButton({ url, title }: Props) {
  const [copied, setCopied] = useState(false);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for older browsers / insecure contexts
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [url]);

  const onClick = useCallback(async () => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url, text: title });
        return;
      } catch (err) {
        // User cancelled the share sheet — do nothing.
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Share failed — fall through to clipboard.
      }
    }
    await copyLink();
  }, [title, url, copyLink]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={copied ? "Link copied" : "Share video"}
      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors ${
        copied
          ? "border-brand-500 text-brand-500"
          : "border-ink-700 text-ink-300 hover:border-brand-500 hover:text-brand-500"
      }`}
    >
      {copied ? <Check size={16} aria-hidden /> : <Share2 size={16} aria-hidden />}
      {copied ? "Copied" : "Share"}
    </button>
  );
}
