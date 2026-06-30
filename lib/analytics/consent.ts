export const CONSENT_STORAGE_KEY = "frizeo_cookie_consent";

export type ConsentChoice = "accepted" | "essential";

export function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(CONSENT_STORAGE_KEY) === "accepted";
}

export function getConsentChoice(): ConsentChoice | null {
  if (typeof window === "undefined") return null;
  const value = localStorage.getItem(CONSENT_STORAGE_KEY);
  if (value === "accepted" || value === "essential") return value;
  return null;
}

export function notifyConsentChange() {
  window.dispatchEvent(new CustomEvent("frizeo-consent-change"));
}

export function onConsentChange(listener: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === CONSENT_STORAGE_KEY) listener();
  };

  window.addEventListener("frizeo-consent-change", listener);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener("frizeo-consent-change", listener);
    window.removeEventListener("storage", handleStorage);
  };
}
