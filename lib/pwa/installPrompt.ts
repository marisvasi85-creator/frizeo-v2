const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

export type InstallPlatform =
  | "ios"
  | "android-installable"
  | "android-manual"
  | "unsupported";

function snoozeStorageKey(scope: string): string {
  return `frizeo-install-prompt-snooze:${scope}`;
}

export function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;

  const nav = window.navigator as Navigator & { standalone?: boolean };

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    nav.standalone === true
  );
}

export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;

  return window.matchMedia("(max-width: 768px)").matches;
}

export function detectInstallPlatform(): InstallPlatform {
  if (typeof window === "undefined") return "unsupported";

  const ua = window.navigator.userAgent;

  if (/iphone|ipad|ipod/i.test(ua)) {
    return "ios";
  }

  if (/android/i.test(ua)) {
    return "android-manual";
  }

  return "unsupported";
}

export function isInstallPromptSnoozed(scope: string): boolean {
  if (typeof window === "undefined") return true;

  const raw = localStorage.getItem(snoozeStorageKey(scope));
  if (!raw) return false;

  const snoozedUntil = Number(raw);
  if (!Number.isFinite(snoozedUntil)) {
    localStorage.removeItem(snoozeStorageKey(scope));
    return false;
  }

  if (Date.now() < snoozedUntil) {
    return true;
  }

  localStorage.removeItem(snoozeStorageKey(scope));
  return false;
}

export function snoozeInstallPrompt(scope: string): void {
  localStorage.setItem(
    snoozeStorageKey(scope),
    String(Date.now() + SNOOZE_MS)
  );
}
