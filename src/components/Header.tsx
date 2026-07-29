"use client";

import { Heart, History, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import SearchBar from "./SearchBar";

const LIBRARY_LINKS = [
  { href: "/favorites", label: "Favorites", Icon: Heart },
  { href: "/history", label: "Watch history", Icon: History },
] as const;

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
          {menuOpen ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
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

        {/* ml-auto pins these right on mobile, where the search bar (which owns
            ml-auto from md up) drops to its own row below. */}
        <nav aria-label="Your library" className="ml-auto flex shrink-0 items-center gap-0.5 md:ml-0">
          {LIBRARY_LINKS.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              className={`rounded-md p-2 transition-colors ${
                pathname === href
                  ? "bg-ink-800 text-brand-500"
                  : "text-ink-300 hover:bg-ink-800 hover:text-ink-100"
              }`}
            >
              <Icon size={18} aria-hidden />
            </Link>
          ))}
        </nav>
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
