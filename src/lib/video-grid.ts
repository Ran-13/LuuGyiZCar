/** Tailwind grid classes for the public video card layout (admin-controlled). */
export function videoGridClassName(columns: 1 | 2 = 2): string {
  if (columns === 1) {
    return "grid grid-cols-1 gap-y-5 sm:gap-y-6";
  }
  return "grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-x-4 sm:gap-y-6";
}

export function normalizeGridColumns(value: unknown): 1 | 2 {
  return Number(value) === 1 ? 1 : 2;
}
