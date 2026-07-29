export interface Category {
  /** URL segment used by /category/[slug]. */
  slug: string;
  label: string;
  /** What actually gets sent to the API as `query`. */
  query: string;
  description: string;
}

export const CATEGORIES: Category[] = [
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

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}
