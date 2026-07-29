"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isAdminUiPath } from "@/lib/admin-path";
import { CATEGORIES } from "@/lib/categories";

export default function Footer() {
  const pathname = usePathname();
  if (isAdminUiPath(pathname)) return null;

  return (
    <footer className="mt-16 border-t border-ink-700 bg-ink-900">
      <div className="mx-auto max-w-[1600px] px-4 py-10">
        <nav aria-label="Categories" className="flex flex-wrap gap-x-4 gap-y-2">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={`/category/${cat.slug}`}
              className="text-sm text-ink-400 transition-colors hover:text-brand-500"
            >
              {cat.label}
            </Link>
          ))}
        </nav>

        <p className="mt-6 max-w-3xl text-xs leading-relaxed text-ink-400">
          LuuGyi Zcar is an adult video streaming index. All content is restricted to adults 18
          years or older.
        </p>

        <p className="mt-4 text-xs text-ink-400">
          © {new Date().getFullYear()} LuuGyi Zcar. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
