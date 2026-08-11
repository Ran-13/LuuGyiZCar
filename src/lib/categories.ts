export interface Category {
  /** URL segment used by /category/[slug]. */
  slug: string;
  label: string;
  /** What actually gets sent to the API as `query`. */
  query: string;
  description: string;
}

/** Built-in defaults — used until a site overrides `feed.categories` in admin. */
export const DEFAULT_CATEGORIES: Category[] = [
  {
    slug: "myanmar",
    label: "Myanmar",
    query: "myanmar",
    description: "Myanmar videos, updated continuously.",
  },
  {
    slug: "japan",
    label: "Japan",
    query: "japan",
    description: "Japanese videos, sorted by what is trending now.",
  },
  {
    slug: "korea",
    label: "Korea",
    query: "korea",
    description: "Korean videos, freshly indexed.",
  },
  {
    slug: "asian",
    label: "Asian",
    query: "asian",
    description: "The full Asian catalog.",
  },
  {
    slug: "romance",
    label: "Romance",
    query: "romance",
    description: "Slower, story-driven romance scenes.",
  },
  {
    slug: "college",
    label: "College",
    query: "college",
    description: "College and campus themed videos.",
  },
  {
    slug: "leaked",
    label: "Leaked",
    query: "leaked",
    description: "Leaked and private-style uploads.",
  },
  {
    slug: "solo",
    label: "Solo",
    query: "solo",
    description: "Solo performances.",
  },
  {
    slug: "amateur",
    label: "Amateur",
    query: "amateur",
    description: "Homemade and amateur uploads.",
  },
  {
    slug: "sexy",
    label: "Sexy",
    query: "sexy",
    description: "A broad sexy mix across every category.",
  },
];

/** @deprecated Prefer site feed categories from readAdsConfig().feed.categories */
export const CATEGORIES = DEFAULT_CATEGORIES;

export function slugifyCategory(label: string): string {
  return (
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "category"
  );
}

export function getCategoryFromList(
  categories: Category[],
  slug: string,
): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

export function getCategory(slug: string): Category | undefined {
  return getCategoryFromList(DEFAULT_CATEGORIES, slug);
}

/** Pick the first keyword that matches a known category query. */
export function detectCategoryLabel(
  keywords: string,
  categories: Category[] = DEFAULT_CATEGORIES,
): string | null {
  if (!keywords) return null;
  const kw = keywords.toLowerCase();
  for (const cat of categories) {
    if (kw.includes(cat.query.toLowerCase())) return cat.label;
  }
  return null;
}
