const MAX_CLIENT_NOTES_LENGTH = 500;

export function normalizeClientNotes(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  const notes = String(value).trim().slice(0, MAX_CLIENT_NOTES_LENGTH);
  return notes || null;
}
