import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <p className="text-5xl font-black text-brand-500">404</p>
      <h1 className="mt-3 text-xl font-bold text-ink-100">Page not found</h1>
      <p className="mt-2 text-sm text-ink-400">
        That video or category does not exist, or is no longer available.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-md bg-brand-500 px-5 py-2.5 text-sm font-bold text-black transition-colors hover:bg-brand-600"
      >
        Back to home
      </Link>
    </div>
  );
}
