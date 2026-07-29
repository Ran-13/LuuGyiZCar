/**
 * localStorage keys and list caps.
 *
 * Deliberately kept out of `use-stored-list.ts`: that module is marked
 * "use client", and a server component importing a value from a client module
 * receives a client *reference* rather than the value. Passing one down as a
 * prop silently yields `undefined` — which is exactly how the saved-video pages
 * ended up reading an empty list. This module has no directive, so both sides
 * import the real strings.
 */

export const STORAGE_KEYS = {
  favorites: "luugyi:favorites",
  history: "luugyi:history",
  recentSearches: "luugyi:recent-searches",
} as const;

export const MAX_HISTORY = 100;
export const MAX_FAVORITES = 500;
export const MAX_RECENT_SEARCHES = 8;
