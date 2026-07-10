export const INSTALL_PROMPT_SNOOZE_KEY = "frizeo-install-prompt-snooze";

const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

export type InstallPlatform =
  | "ios"
  | "android-installable"
  | "android-manual"
  | "unsupported";

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

export function isInstallPromptSnoozed(): boolean {
  if (typeof window === "undefined") return true;

  const raw = localStorage.getItem(INSTALL_PROMPT_SNOOZE_KEY);
  if (!raw) return false;

  const snoozedUntil = Number(raw);
  if (!Number.isFinite(snoozedUntil)) {
    localStorage.removeItem(INSTALL_PROMPT_SNOOZE_KEY);
    return false;
  }

  if (Date.now() < snoozedUntil) {
    return true;
  }

  localStorage.removeItem(INSTALL_PROMPT_SNOOZE_KEY);
  return false;
}

export function snoozeInstallPrompt(): void {
  localStorage.setItem(
    INSTALL_PROMPT_SNOOZE_KEY,
    String(Date.now() + SNOOZE_MS)
  );
}
