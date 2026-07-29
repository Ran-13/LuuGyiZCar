import Link from "next/link";
import { SORT_ORDERS, type SortOrder } from "@/lib/eporner";

interface Props {
  active: SortOrder;
  basePath: string;
  params?: Record<string, string | undefined>;
}

/** Changing sort resets to page 1 — a page-8 offset is meaningless under a new ordering. */
export default function SortTabs({ active, basePath, params = {} }: Props) {
  const href = (order: SortOrder) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value);
    }
    search.set("order", order);
    return `${basePath}?${search.toString()}`;
  };

  return (
    <div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3 sm:mx-0 sm:px-0">
      {SORT_ORDERS.map(({ value, label }) => (
        <Link
          key={value}
          href={href(value)}
          aria-current={value === active ? "true" : undefined}
          className={`shrink-0 rounded-md border px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors ${
            value === active
              ? "border-brand-500 bg-brand-500 text-black"
              : "border-ink-700 bg-ink-850 text-ink-300 hover:border-ink-600 hover:text-ink-100"
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
