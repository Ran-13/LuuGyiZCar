"use client";

import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { MAX_RECENT_SEARCHES, STORAGE_KEYS } from "@/lib/storage-keys";
import { useStoredList, type StoredItem } from "@/lib/use-stored-list";

interface RecentSearch extends StoredItem {
  /** The query text; also used as the id so repeats de-duplicate. */
  id: string;
}

const RECENT_LIST_ID = "recent-searches-list";

export default function SearchBar({ className = "" }: { className?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    items: recent,
    add,
    remove,
  } = useStoredList<RecentSearch>(STORAGE_KEYS.recentSearches, MAX_RECENT_SEARCHES);

  const submit = (query: string) => {
    const q = query.trim();
    if (!q) return;
    add({ id: q });
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit(value);
  };

  // A blur fires before the dropdown's click lands, so closing is deferred.
  const onBlur = () => {
    blurTimer.current = setTimeout(() => setOpen(false), 120);
  };
  const cancelClose = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  };

  const showDropdown = open && recent.length > 0;

  return (
    <div className={`relative w-full ${className}`}>
      <form
        onSubmit={onSubmit}
        role="search"
        className="flex w-full items-center rounded-md border border-ink-700 bg-ink-850 transition-colors focus-within:border-brand-500"
      >
        <input
          type="search"
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={onBlur}
          placeholder="Search videos…"
          aria-label="Search videos"
          // ARIA 1.2 combobox pattern: aria-expanded is only valid once the
          // input is explicitly a combobox, not the implicit searchbox role.
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={RECENT_LIST_ID}
          aria-autocomplete="list"
          // focus-visible (not focus) so this beats the global *:focus-visible
          // ring in globals.css — the wrapper's focus-within border is the only
          // focus indicator this control needs.
          className="min-w-0 flex-1 bg-transparent px-3 py-1.5 text-sm text-ink-100 placeholder:text-ink-400 focus:outline-none focus-visible:outline-none"
        />
        <button
          type="submit"
          aria-label="Search"
          className="m-1 rounded bg-brand-500 px-3 py-1.5 text-black transition-colors hover:bg-brand-600"
        >
          <Search size={16} strokeWidth={2.5} aria-hidden />
        </button>
      </form>

      {showDropdown && (
        <div
          onMouseDown={cancelClose}
          className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-md border border-ink-700 bg-ink-900 shadow-xl"
        >
          <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">
            Recent searches
          </p>
          <ul id={RECENT_LIST_ID} role="listbox" aria-label="Recent searches">
            {recent.map((item) => (
              <li key={item.id} role="option" aria-selected={false} className="flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    setValue(item.id);
                    submit(item.id);
                  }}
                  className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100"
                >
                  {item.id}
                </button>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  aria-label={`Remove ${item.id} from recent searches`}
                  className="px-3 py-2 text-ink-600 transition-colors hover:text-brand-500"
                >
                  <X size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
