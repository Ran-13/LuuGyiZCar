"use client";

import { useState } from "react";

interface Props {
  src: string;
  title: string;
}

/**
 * Eporner embed iframe.
 *
 * Avoid referrerPolicy=no-referrer — on many mobile browsers (esp. iOS Safari)
 * that blanks the player to a white frame while desktop still works.
 */
export default function VideoEmbed({ src, title }: Props) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink-900 px-4 text-center">
        <p className="text-sm text-ink-300">Player could not load on this device.</p>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-bold text-black"
        >
          Open player
        </a>
      </div>
    );
  }

  return (
    <iframe
      src={src}
      title={title}
      className="absolute inset-0 h-full w-full border-0 bg-black"
      allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
      allowFullScreen
      // Send a referrer so the embed CDN authorizes the play session on mobile.
      referrerPolicy="strict-origin-when-cross-origin"
      loading="eager"
      onError={() => setFailed(true)}
    />
  );
}
