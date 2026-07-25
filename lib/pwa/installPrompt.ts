/** Soft snooze after the banner is shown once (covers “ignore without tapping”). */
const SHOWN_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export type InstallPlatform =
  | "ios"
  | "android-installable"
  | "android-manual"
  | "unsupported";

function snoozeStorageKey(scope: string): string {
  return `frizeo-install-prompt-snooze:${scope}`;
}

function dismissedStorageKey(scope: string): string {
  return `frizeo-install-prompt-dismissed:${scope}`;
}

function installedStorageKey(scope: string): string {
  return `frizeo-install-prompt-installed:${scope}`;
}

function sessionSeenStorageKey(scope: string): string {
  return `frizeo-install-prompt-seen:${scope}`;
}

function readLocalFlag(key: string): boolean {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeLocalFlag(key: string): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // Private mode / blocked storage — prompt may reappear; ignore.
  }
}

function readSessionFlag(key: string): boolean {
  if (typeof window === "undefined") return false;

  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeSessionFlag(key: string): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Ignore storage failures.
  }
}

export function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;

  const nav = window.navigator as Navigator & { standalone?: boolean };

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
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

/** Legacy 14-day snooze — kept so older dismissals still suppress the prompt. */
export function isInstallPromptSnoozed(scope: string): boolean {
  if (typeof window === "undefined") return true;

  try {
    const raw = window.localStorage.getItem(snoozeStorageKey(scope));
    if (!raw) return false;

    const snoozedUntil = Number(raw);
    if (!Number.isFinite(snoozedUntil)) {
      window.localStorage.removeItem(snoozeStorageKey(scope));
      return false;
    }

    if (Date.now() < snoozedUntil) {
      return true;
    }

    window.localStorage.removeItem(snoozeStorageKey(scope));
    return false;
  } catch {
    return false;
  }
}

export function isInstallPromptDismissed(scope: string): boolean {
  return readLocalFlag(dismissedStorageKey(scope));
}

export function isAppInstallRecorded(scope: string): boolean {
  return readLocalFlag(installedStorageKey(scope));
}

export function wasInstallPromptSeenThisSession(scope: string): boolean {
  return readSessionFlag(sessionSeenStorageKey(scope));
}

export function shouldSuppressInstallPrompt(scope: string): boolean {
  return (
    isStandaloneMode() ||
    isAppInstallRecorded(scope) ||
    isInstallPromptDismissed(scope) ||
    isInstallPromptSnoozed(scope) ||
    wasInstallPromptSeenThisSession(scope)
  );
}

/** Permanent dismiss — "Nu acum" / "Am înțeles". */
export function dismissInstallPrompt(scope: string): void {
  writeLocalFlag(dismissedStorageKey(scope));
  writeSessionFlag(sessionSeenStorageKey(scope));
}

/** Record that the app was installed (native prompt accepted or appinstalled). */
export function markAppInstalled(scope: string): void {
  writeLocalFlag(installedStorageKey(scope));
  writeSessionFlag(sessionSeenStorageKey(scope));
}

/**
 * Mark as shown: blocks remounts this session, and soft-snoozes for a week
 * so ignoring (no button tap) doesn't bring it back on every admin visit.
 */
export function markInstallPromptSeenThisSession(scope: string): void {
  writeSessionFlag(sessionSeenStorageKey(scope));

  if (typeof window === "undefined") return;

  try {
    const key = snoozeStorageKey(scope);
    const existing = window.localStorage.getItem(key);
    const existingUntil = existing ? Number(existing) : 0;
    const nextUntil = Date.now() + SHOWN_SNOOZE_MS;

    // Don't shorten a longer snooze / leave permanent dismiss alone.
    if (
      isInstallPromptDismissed(scope) ||
      isAppInstallRecorded(scope) ||
      (Number.isFinite(existingUntil) && existingUntil >= nextUntil)
    ) {
      return;
    }

    window.localStorage.setItem(key, String(nextUntil));
  } catch {
    // Ignore storage failures.
  }
}

/** @deprecated Prefer dismissInstallPrompt — kept for any external callers. */
export function snoozeInstallPrompt(scope: string): void {
  dismissInstallPrompt(scope);
}
