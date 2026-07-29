import Link from "next/link";

interface Props {
  title: string;
  /** Optional right-aligned link, e.g. "See all". */
  href?: string;
  linkLabel?: string;
  subtitle?: string;
  as?: "h1" | "h2";
}

export default function SectionHeading({
  title,
  href,
  linkLabel = "See all",
  subtitle,
  as: Tag = "h2",
}: Props) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <Tag className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-ink-100 sm:text-xl">
          <span className="h-5 w-1 shrink-0 rounded-full bg-brand-500" aria-hidden />
          <span className="truncate">{title}</span>
        </Tag>
        {subtitle && <p className="mt-1 pl-3.5 text-xs text-ink-400 sm:text-sm">{subtitle}</p>}
      </div>

      {href && (
        <Link
          href={href}
          className="shrink-0 text-xs font-semibold text-brand-500 transition-colors hover:text-brand-400 sm:text-sm"
        >
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}
