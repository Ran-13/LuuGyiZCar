"use client";

import { useEffect } from "react";

export type AdminNavItem = {
  id: string;
  label: string;
};

type AdminShellProps = {
  title?: string;
  nav: AdminNavItem[];
  activeId: string;
  onNavigate: (id: string) => void;
  onLogout: () => void;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
};

export default function AdminShell({
  title = "Admin",
  nav,
  activeId,
  onNavigate,
  onLogout,
  menuOpen,
  onMenuOpenChange,
  headerActions,
  children,
}: AdminShellProps) {
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMenuOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, onMenuOpenChange]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const activeLabel = nav.find((item) => item.id === activeId)?.label ?? title;

  function go(id: string) {
    onNavigate(id);
    onMenuOpenChange(false);
  }

  const navList = (
    <nav className="flex flex-1 flex-col gap-0.5 p-3" aria-label="Admin sections">
      {nav.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => go(item.id)}
            className={`rounded-md px-3 py-2 text-left text-sm transition-colors ${
              active
                ? "bg-ink-800 font-medium text-brand-500"
                : "text-ink-300 hover:bg-ink-850 hover:text-ink-100"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-dvh bg-ink-950 lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-ink-800 bg-ink-900 lg:flex">
        <div className="border-b border-ink-800 px-4 py-4">
          <p className="text-sm font-bold tracking-wide text-ink-100">{title}</p>
        </div>
        {navList}
        <div className="border-t border-ink-800 p-3">
          <button
            type="button"
            onClick={onLogout}
            className="w-full rounded-md border border-ink-700 px-3 py-2 text-sm text-ink-300 hover:border-ink-600 hover:text-ink-100"
          >
            Log out
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-40 lg:hidden ${menuOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!menuOpen}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-black/60 transition-opacity ${
            menuOpen ? "opacity-100" : "opacity-0"
          }`}
          aria-label="Close menu"
          onClick={() => onMenuOpenChange(false)}
        />
        <aside
          className={`absolute inset-y-0 left-0 flex w-[min(18rem,85vw)] flex-col border-r border-ink-800 bg-ink-900 shadow-xl transition-transform ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-ink-800 px-4 py-3">
            <p className="text-sm font-bold text-ink-100">{title}</p>
            <button
              type="button"
              onClick={() => onMenuOpenChange(false)}
              className="rounded-md px-2 py-1 text-sm text-ink-400 hover:bg-ink-800 hover:text-ink-100"
            >
              Close
            </button>
          </div>
          {navList}
          <div className="border-t border-ink-800 p-3">
            <button
              type="button"
              onClick={onLogout}
              className="w-full rounded-md border border-ink-700 px-3 py-2 text-sm text-ink-300 hover:border-ink-600 hover:text-ink-100"
            >
              Log out
            </button>
          </div>
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-ink-800 bg-ink-950/95 px-3 py-3 backdrop-blur sm:px-5">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-ink-700 text-ink-200 lg:hidden"
            aria-label="Open menu"
            onClick={() => onMenuOpenChange(true)}
          >
            <span className="sr-only">Menu</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-ink-100 sm:text-lg">
            {activeLabel}
          </h1>
          {headerActions}
        </header>

        <main className="flex-1 px-3 py-4 sm:px-5 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
