"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * localStorage-backed list, read through useSyncExternalStore.
 *
 * Deliberately not useEffect + setState: the project's ESLint config enforces
 * `react-hooks/set-state-in-effect`, and the effect version also flashes empty
 * content on first paint. This keeps SSR output and the first client render in
 * agreement (both empty) and then swaps in the stored value.
 */

export interface StoredItem {
  id: string;
}

/** Stable reference — getSnapshot must never return a fresh array or React loops forever. */
const EMPTY: readonly never[] = Object.freeze([]);

const listeners = new Map<string, Set<() => void>>();
const snapshots = new Map<string, readonly unknown[]>();

function readStorage(key: string): readonly unknown[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : EMPTY;
  } catch {
    // Corrupt JSON or storage disabled — behave as if nothing was saved.
    return EMPTY;
  }
}

function getSnapshot(key: string): readonly unknown[] {
  const cached = snapshots.get(key);
  if (cached) return cached;

  const value = readStorage(key);
  snapshots.set(key, value);
  return value;
}

function notify(key: string): void {
  for (const listener of listeners.get(key) ?? []) listener();
}

function invalidate(key: string): void {
  snapshots.delete(key);
  notify(key);
}


function write(key: string, next: readonly unknown[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Quota exceeded or private mode — keep the in-memory view consistent anyway.
  }
  snapshots.set(key, next);
  notify(key);
}

function subscribe(key: string, onChange: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(onChange);

  // Keeps other tabs in sync.
  const onStorage = (event: StorageEvent) => {
    if (event.key === key) invalidate(key);
  };
  window.addEventListener("storage", onStorage);

  return () => {
    set.delete(onChange);
    if (set.size === 0) listeners.delete(key);
    window.removeEventListener("storage", onStorage);
  };
}

export interface StoredListApi<T extends StoredItem> {
  items: readonly T[];
  /** Prepends, de-duplicating by id and trimming to `max`. */
  add: (item: T) => void;
  remove: (id: string) => void;
  /** Adds if absent, removes if present. */
  toggle: (item: T) => void;
  clear: () => void;
}

export function useStoredList<T extends StoredItem>(key: string, max = 100): StoredListApi<T> {
  const sub = useCallback((onChange: () => void) => subscribe(key, onChange), [key]);
  const clientSnapshot = useCallback(() => getSnapshot(key) as readonly T[], [key]);
  const serverSnapshot = useCallback(() => EMPTY as readonly T[], []);

  const items = useSyncExternalStore(sub, clientSnapshot, serverSnapshot);

  const add = useCallback(
    (item: T) => {
      const current = getSnapshot(key) as readonly T[];
      write(key, [item, ...current.filter((i) => i.id !== item.id)].slice(0, max));
    },
    [key, max],
  );

  const remove = useCallback(
    (id: string) => {
      const current = getSnapshot(key) as readonly T[];
      write(
        key,
        current.filter((i) => i.id !== id),
      );
    },
    [key],
  );

  const toggle = useCallback(
    (item: T) => {
      const current = getSnapshot(key) as readonly T[];
      const next = current.some((i) => i.id === item.id)
        ? current.filter((i) => i.id !== item.id)
        : [item, ...current].slice(0, max);
      write(key, next);
    },
    [key, max],
  );

  const clear = useCallback(() => write(key, EMPTY), [key]);

  return { items, add, remove, toggle, clear };
}

// Keys and caps live in ./storage-keys so server components can import them
// without crossing this module's "use client" boundary.
