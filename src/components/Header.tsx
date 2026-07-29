"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import SearchBar from "./SearchBar";

export default function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-ink-700 bg-ink-900/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1800px] items-center gap-3 px-3 py-2.5 sm:px-5 sm:gap-4">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          className="-ml-1 rounded-md p-2 text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100 lg:hidden"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d={menuOpen ? "M6 6l12 12M18 6L6 18" : "M4 6h16M4 12h16M4 18h16"} strokeLinecap="round" />
          </svg>
        </button>

        <Link
          href="/"
          onClick={closeMenu}
          className="shrink-0 text-lg font-black tracking-tighter sm:text-xl"
        >
          <span className="text-ink-100">LuuGyi</span>
          <span className="ml-1 rounded bg-brand-500 px-1.5 py-0.5 text-black">Zcar</span>
        </Link>

        {/* Desktop category rail sits inline with the logo to keep the bar to one row. */}
        <nav className="no-scrollbar hidden min-w-0 flex-1 gap-0.5 overflow-x-auto lg:flex">
          {CATEGORIES.map((cat) => {
            const active = pathname === `/category/${cat.slug}`;
            return (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className={`shrink-0 rounded-md px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors ${
                  active
                    ? "bg-ink-800 text-brand-500"
                    : "text-ink-300 hover:bg-ink-800 hover:text-ink-100"
                }`}
              >
                {cat.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden w-full max-w-sm shrink-0 md:block">
          <Suspense fallback={null}>
            <SearchBar />
          </Suspense>
        </div>
      </div>

      <div className="px-3 pb-2.5 md:hidden">
        <Suspense fallback={null}>
          <SearchBar />
        </Suspense>
      </div>

      {menuOpen && (
        <nav className="border-t border-ink-700 bg-ink-900 px-3 py-2 lg:hidden">
          <ul className="grid grid-cols-2 gap-1 sm:grid-cols-4">
            {CATEGORIES.map((cat) => {
              const active = pathname === `/category/${cat.slug}`;
              return (
                <li key={cat.slug}>
                  <Link
                    href={`/category/${cat.slug}`}
                    onClick={closeMenu}
                    className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-ink-800 font-semibold text-brand-500"
                        : "text-ink-300 hover:bg-ink-800 hover:text-ink-100"
                    }`}
                  >
                    {cat.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}
