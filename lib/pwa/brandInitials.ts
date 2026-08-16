/**
 * Build a short brand mark from a salon/barber display name.
 * "SocoBarberShop Wassell" → "SW"
 */
export function brandInitials(name: string | null | undefined): string {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) return "F";

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const first = firstLetter(words[0]);
    const last = firstLetter(words[words.length - 1]);
    if (first && last) return `${first}${last}`;
  }

  const single = words[0] ?? trimmed;
  const camelParts = single.match(/[A-ZĂÂÎȘȚ][a-zăâîșț]+|[A-Za-zĂÂÎȘȚăâîșț]+/g);
  if (camelParts && camelParts.length >= 2) {
    const a = firstLetter(camelParts[0]);
    const b = firstLetter(camelParts[1]);
    if (a && b) return `${a}${b}`;
  }

  const letters = single.replace(/[^\p{L}\p{N}]/gu, "");
  if (letters.length >= 2) return letters.slice(0, 2).toLocaleUpperCase("ro-RO");
  if (letters.length === 1) return letters.toLocaleUpperCase("ro-RO");
  return "F";
}

function firstLetter(value: string): string | null {
  const match = value.match(/\p{L}|\p{N}/u);
  return match ? match[0].toLocaleUpperCase("ro-RO") : null;
}
