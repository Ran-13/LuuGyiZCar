import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";

export default function Footer() {
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
          All video metadata and thumbnails are provided by the public Eporner API. This site hosts
          no media files — playback is served from the original provider. Content is restricted to
          adults 18 or older.
        </p>

        <p className="mt-4 text-xs text-ink-400">
          © {new Date().getFullYear()} LuuGyi Zcar — built on the Eporner API v2.
        </p>
      </div>
    </footer>
  );
}
