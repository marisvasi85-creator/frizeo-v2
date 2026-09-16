/**
 * Restrictive client-side filter for injected-browser / WebView noise.
 *
 * Facebook Android WebView / Facebook browser_declutter:
 *   drop ONLY when the message matches the demonstrated signature AND a
 *   stack frame source confirms that injected script AND no first-party
 *   Frizeo frame is present.
 *
 * Firefox iOS (`window.__firefox__`):
 *   drop ONLY when the message names the Firefox-injected object AND no
 *   first-party Frizeo frame is present.
 *
 * Never drop based on browser.name (Facebook In-App Browser can still hit
 * real Frizeo bugs). Never match generic TypeError / SyntaxError / postMessage /
 * Load failed / network error / Failed to fetch / chunk load strings.
 *
 * Revert: remove the `shouldDropExternalBrowserNoise` call from
 * `getSharedSentryOptions().beforeSend` in `lib/sentry/shared.ts`.
 */

export type BrowserNoiseFrame = {
  filename?: string;
  abs_path?: string;
  function?: string;
  module?: string;
};

export type BrowserNoiseException = {
  type?: string;
  value?: string;
  stacktrace?: {
    frames?: BrowserNoiseFrame[];
  };
};

export type BrowserNoiseEvent = {
  message?: string;
  exception?: {
    values?: BrowserNoiseException[];
  };
};

/**
 * Sentry ErrorEvent is a structural superset of this shape. The filter
 * reads only exception stacks + messages — never browser.name, URL, or
 * transaction — so a Facebook In-App Browser session can still report
 * real Frizeo bugs.
 */

const FACEBOOK_ANDROID_JAVA_BRIDGE_GONE =
  /Error invoking \S+: Java object is gone/i;

const FACEBOOK_ANDROID_NAV_LOGGER = "navigation_performance_logger_android";

const FACEBOOK_BROWSER_DECLUTTER = "browser_declutter";

const UNEXPECTED_END_OF_INPUT = /Unexpected end of input/i;

/**
 * Firefox for iOS (WebKit) injects `window.__firefox__`. The JSC message
 * formats below are the demonstrated signatures — not generic TypeErrors.
 */
const FIREFOX_IOS_INTERNAL = [
  /window\.__firefox__/i,
  /Can't find variable:\s*__firefox__/i,
  /__firefox__\s+is not defined/i,
];

const THIRD_PARTY_SOURCE =
  /node_modules|[\\/]@sentry[\\/]|sentry\.client|sentry\.server|sentry\.edge/i;

/**
 * First-party = Frizeo bundled / source-mapped application code.
 * Page URLs without `/_next/` are NOT treated as first-party: injected
 * scripts often report the host page as `filename`.
 *
 * `app://...` WebView schemes must not match `app/` source paths.
 */
const FIRST_PARTY_SOURCE = [
  /(?:www\.)?frizeo\.ro\/_next\//i,
  /staging\.frizeo\.ro\/_next\//i,
  /email\.frizeo\.ro\/_next\//i,
  /\.vercel\.app\/_next\//i,
  /\/_next\/static\//i,
  /webpack:\/+\/_next\//i,
  /webpack:\/\/_N_E\/\.\/(?:app|components|lib|hooks|pages)\b/i,
  /turbopack:\/\/[^/]+\/(?:app|components|lib|hooks|pages)\b/i,
  /(?:^|[\\/])(?:app|components|lib|hooks|pages)[\\/]/,
];

function combinedExceptionText(event: BrowserNoiseEvent): string {
  const parts: string[] = [];
  if (event.message) parts.push(event.message);
  for (const exception of event.exception?.values ?? []) {
    if (exception.type) parts.push(exception.type);
    if (exception.value) parts.push(exception.value);
  }
  return parts.join("\n");
}

function allFrames(event: BrowserNoiseEvent): BrowserNoiseFrame[] {
  const frames: BrowserNoiseFrame[] = [];
  for (const exception of event.exception?.values ?? []) {
    for (const frame of exception.stacktrace?.frames ?? []) {
      frames.push(frame);
    }
  }
  return frames;
}

function frameSources(frame: BrowserNoiseFrame): string[] {
  return [frame.filename, frame.abs_path, frame.module, frame.function].filter(
    (value): value is string => Boolean(value),
  );
}

function framesMention(event: BrowserNoiseEvent, needle: string): boolean {
  const lower = needle.toLowerCase();
  return allFrames(event).some((frame) =>
    frameSources(frame).some((source) => source.toLowerCase().includes(lower)),
  );
}

export function isFirstPartyFrame(frame: BrowserNoiseFrame): boolean {
  const sources = frameSources(frame);
  if (sources.length === 0) return false;
  if (sources.some((source) => THIRD_PARTY_SOURCE.test(source))) return false;
  return sources.some((source) =>
    FIRST_PARTY_SOURCE.some((pattern) => pattern.test(source)),
  );
}

export function hasRelevantFirstPartyFrame(event: BrowserNoiseEvent): boolean {
  return allFrames(event).some(isFirstPartyFrame);
}

function isFacebookAndroidWebViewJavaBridgeGone(
  event: BrowserNoiseEvent,
): boolean {
  if (!FACEBOOK_ANDROID_JAVA_BRIDGE_GONE.test(combinedExceptionText(event))) {
    return false;
  }
  return framesMention(event, FACEBOOK_ANDROID_NAV_LOGGER);
}

function isFacebookInAppBrowserDeclutter(event: BrowserNoiseEvent): boolean {
  if (!UNEXPECTED_END_OF_INPUT.test(combinedExceptionText(event))) {
    return false;
  }
  return framesMention(event, FACEBOOK_BROWSER_DECLUTTER);
}

function isFirefoxIosInjectedInternal(event: BrowserNoiseEvent): boolean {
  const text = combinedExceptionText(event);
  return FIREFOX_IOS_INTERNAL.some((pattern) => pattern.test(text));
}

/**
 * Returns true only for demonstrated injected-browser noise with no
 * first-party Frizeo frames in the exception stack.
 *
 * Intentionally NOT filtered (insufficient or unsafe signatures):
 * - TypeError: Load failed / network error / Failed to fetch / NetworkError
 * - generic SyntaxError / TypeError / ReferenceError / postMessage
 * - window.webkit.messageHandlers (no confirmed injected-script filename)
 * - browser.name === "Facebook" alone
 * - chunk loading errors, Supabase, API, auth, booking, /admin/**
 */
export function shouldDropExternalBrowserNoise(
  event: BrowserNoiseEvent,
): boolean {
  // Safety net: any relevant Frizeo frame → keep. A real bug can surface
  // inside Facebook In-App Browser / WebView.
  if (hasRelevantFirstPartyFrame(event)) {
    return false;
  }

  return (
    isFacebookAndroidWebViewJavaBridgeGone(event) ||
    isFacebookInAppBrowserDeclutter(event) ||
    isFirefoxIosInjectedInternal(event)
  );
}
