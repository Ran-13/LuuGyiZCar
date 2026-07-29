"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

interface Props {
  className?: string;
}

export default function SearchBar({ className = "" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <form
      onSubmit={onSubmit}
      role="search"
      className={`group flex w-full items-center rounded-md border border-ink-700 bg-ink-850 transition-colors focus-within:border-brand-500 ${className}`}
    >
      <input
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search videos…"
        aria-label="Search videos"
        className="min-w-0 flex-1 bg-transparent px-3 py-1.5 text-sm text-ink-100 placeholder:text-ink-400 focus:outline-none"
      />
      <button
        type="submit"
        aria-label="Search"
        className="m-1 rounded bg-brand-500 px-3 py-1.5 text-black transition-colors hover:bg-brand-600"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </button>
    </form>
  );
}
