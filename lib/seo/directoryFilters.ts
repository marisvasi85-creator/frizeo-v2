/** Directory filter chips — matched against active service names. */
export const DIRECTORY_FILTERS = [
  { id: "fade", label: "Fade", patterns: ["fade", "skin fade", "low fade", "mid fade", "high fade"] },
  { id: "barba", label: "Barbă", patterns: ["barbă", "barba", "beard", "ras"] },
  { id: "tuns", label: "Tuns", patterns: ["tuns", "tunsoare", "haircut", "tăiere", "taiere"] },
  { id: "copii", label: "Copii", patterns: ["copii", "copil", "kids", "junior"] },
  { id: "femei", label: "Femei", patterns: ["femei", "damă", "dama", "doamne", "coafat"] },
  { id: "spalat", label: "Spălat", patterns: ["spălat", "spalat", "wash"] },
] as const;

export type DirectoryFilterId = (typeof DIRECTORY_FILTERS)[number]["id"];

export function matchServiceFilters(serviceNames: string[]): DirectoryFilterId[] {
  const blob = serviceNames.join(" | ").toLowerCase();
  const matched: DirectoryFilterId[] = [];

  for (const filter of DIRECTORY_FILTERS) {
    if (filter.patterns.some((p) => blob.includes(p.toLowerCase()))) {
      matched.push(filter.id);
    }
  }

  return matched;
}

export function salonMatchesFilters(
  salonTags: DirectoryFilterId[],
  selected: string[]
): boolean {
  if (selected.length === 0) return true;
  return selected.every((id) =>
    salonTags.includes(id as DirectoryFilterId)
  );
}
