export const SAVED_CLIENT_DETAILS_KEY = "frizeo_booking_client_details";

export type SavedClientDetails = {
  name: string;
  phone: string;
  email: string;
};

export function loadSavedClientDetails(): SavedClientDetails | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(SAVED_CLIENT_DETAILS_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<SavedClientDetails>;
    if (typeof parsed.name !== "string" || typeof parsed.phone !== "string") {
      return null;
    }

    return {
      name: parsed.name,
      phone: parsed.phone,
      email: typeof parsed.email === "string" ? parsed.email : "",
    };
  } catch {
    return null;
  }
}

export function saveSavedClientDetails(details: SavedClientDetails): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(
      SAVED_CLIENT_DETAILS_KEY,
      JSON.stringify({
        name: details.name,
        phone: details.phone,
        email: details.email,
      }),
    );
  } catch {
    // Ignore quota errors or blocked storage.
  }
}
