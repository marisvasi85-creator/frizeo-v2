/** Best-effort city extraction from a free-form Romanian address. */
export function extractCityHint(address: string | null | undefined): string | null {
  if (!address?.trim()) return null;

  const cleaned = address
    .replace(/\b(România|Romania|RO)\b/gi, "")
    .replace(/\b\d{5,6}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const parts = cleaned
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) return null;

  // Prefer last meaningful segment (usually city), skip street-like prefixes.
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i]
      .replace(/^(jud\.?|județul|municipiul|orașul|satul)\s+/i, "")
      .trim();
    if (!part) continue;
    if (/^(str\.?|bd\.?|bulevardul|aleea|drumul)\b/i.test(part)) continue;
    if (part.length < 2 || part.length > 40) continue;
    return part;
  }

  return null;
}
