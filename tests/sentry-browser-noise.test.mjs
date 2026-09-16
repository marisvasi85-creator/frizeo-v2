import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  shouldDropExternalBrowserNoise,
} from "../lib/sentry/browserNoise.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function exceptionEvent({
  type = "Error",
  value,
  frames = [],
  url,
  transaction,
  browserName,
}) {
  return {
    exception: {
      values: [
        {
          type,
          value,
          stacktrace: { frames },
        },
      ],
    },
    request: url ? { url } : undefined,
    transaction,
    contexts: browserName ? { browser: { name: browserName } } : undefined,
  };
}

function shouldDrop(event) {
  return shouldDropExternalBrowserNoise(event);
}

test("DROP A: Facebook Android postMessage Java object is gone", () => {
  assert.equal(
    shouldDrop(
      exceptionEvent({
        value: "Error invoking postMessage: Java object is gone",
        frames: [
          { filename: "app://navigation_performance_logger_android" },
        ],
      }),
    ),
    true,
  );
});

test("DROP B: Facebook Android enableDidUserTypeOnKeyboardLogging", () => {
  assert.equal(
    shouldDrop(
      exceptionEvent({
        value:
          "Error invoking enableDidUserTypeOnKeyboardLogging: Java object is gone",
        frames: [
          { filename: "app://navigation_performance_logger_android" },
        ],
      }),
    ),
    true,
  );
});

test("DROP extra: Facebook Android enableButtonsClickedMetaDataLogging", () => {
  assert.equal(
    shouldDrop(
      exceptionEvent({
        value:
          "Error invoking enableButtonsClickedMetaDataLogging: Java object is gone",
        frames: [
          {
            filename: "app://navigation_performance_logger_android",
            function: "sendBeforeUnloadMessage",
          },
        ],
      }),
    ),
    true,
  );
});

test("DROP C: Unexpected end of input from Facebook browser_declutter", () => {
  assert.equal(
    shouldDrop(
      exceptionEvent({
        type: "SyntaxError",
        value: "Unexpected end of input",
        frames: [{ filename: "app://browser_declutter", lineno: 37, colno: 40 }],
        url: "https://www.frizeo.ro/frizerii/demo?fbclid=abc",
        browserName: "Facebook",
      }),
    ),
    true,
  );
});

test("KEEP D: Unexpected end of input from first-party Frizeo", () => {
  assert.equal(
    shouldDrop(
      exceptionEvent({
        type: "SyntaxError",
        value: "Unexpected end of input",
        frames: [
          {
            filename:
              "https://www.frizeo.ro/_next/static/chunks/app/booking/page.js",
          },
        ],
      }),
    ),
    false,
  );
});

test("KEEP E: Load failed on /admin/dashboard", () => {
  assert.equal(
    shouldDrop(
      exceptionEvent({
        type: "TypeError",
        value: "Load failed",
        frames: [
          {
            filename:
              "https://www.frizeo.ro/_next/static/chunks/app/admin/dashboard/page.js",
          },
        ],
        url: "https://www.frizeo.ro/admin/dashboard",
        transaction: "/admin/dashboard",
      }),
    ),
    false,
  );
});

test("KEEP F: network error on /admin/dashboard", () => {
  assert.equal(
    shouldDrop(
      exceptionEvent({
        type: "TypeError",
        value: "network error",
        frames: [
          {
            filename:
              "https://www.frizeo.ro/_next/static/chunks/app/admin/dashboard/page.js",
          },
        ],
        url: "https://www.frizeo.ro/admin/dashboard",
        transaction: "/admin/dashboard",
      }),
    ),
    false,
  );
});

test("KEEP G: generic postMessage error from a Frizeo component", () => {
  assert.equal(
    shouldDrop(
      exceptionEvent({
        type: "Error",
        value: "Failed to execute 'postMessage' on 'Window': target origin mismatch",
        frames: [
          {
            filename: "webpack://_N_E/./app/components/ShareButton.tsx",
            function: "ShareButton",
          },
        ],
      }),
    ),
    false,
  );
});

test("KEEP H: first-party booking error inside Facebook In-App Browser", () => {
  assert.equal(
    shouldDrop(
      exceptionEvent({
        type: "TypeError",
        value: "Cannot read properties of undefined (reading 'startAt')",
        frames: [
          {
            filename: "webpack://_N_E/./app/components/BookingForm.tsx",
            function: "BookingForm",
          },
        ],
        url: "https://www.frizeo.ro/frizerii/demo?fbclid=abc",
        browserName: "Facebook",
      }),
    ),
    false,
  );
});

test("KEEP: Java object is gone without the Android nav logger stack", () => {
  assert.equal(
    shouldDrop(
      exceptionEvent({
        value: "Error invoking postMessage: Java object is gone",
        frames: [
          {
            filename: "https://www.frizeo.ro/_next/static/chunks/app/page.js",
          },
        ],
      }),
    ),
    false,
  );
});

test("KEEP: Java object is gone with logger stack AND a first-party frame", () => {
  assert.equal(
    shouldDrop(
      exceptionEvent({
        value: "Error invoking postMessage: Java object is gone",
        frames: [
          { filename: "app://navigation_performance_logger_android" },
          {
            filename: "https://www.frizeo.ro/_next/static/chunks/app/page.js",
            function: "BookButton",
          },
        ],
      }),
    ),
    false,
  );
});

test("KEEP: generic postMessage without first-party or Facebook logger", () => {
  assert.equal(
    shouldDrop(
      exceptionEvent({
        value: "postMessage failed",
        frames: [{ filename: "https://connect.facebook.net/en_US/sdk.js" }],
      }),
    ),
    false,
  );
});

test("KEEP: Unexpected end of input without browser_declutter", () => {
  assert.equal(
    shouldDrop(
      exceptionEvent({
        type: "SyntaxError",
        value: "Unexpected end of input",
        frames: [{ filename: "https://connect.facebook.net/en_US/sdk.js" }],
        browserName: "Facebook",
      }),
    ),
    false,
  );
});

test("KEEP: Failed to fetch and NetworkError stay visible", () => {
  assert.equal(
    shouldDrop(
      exceptionEvent({
        type: "TypeError",
        value: "Failed to fetch",
        url: "https://www.frizeo.ro/admin/dashboard",
      }),
    ),
    false,
  );
  assert.equal(
    shouldDrop(
      exceptionEvent({
        type: "TypeError",
        value: "NetworkError when attempting to fetch resource.",
        url: "https://www.frizeo.ro/api/slots",
      }),
    ),
    false,
  );
});

test("KEEP: chunk loading errors stay visible", () => {
  assert.equal(
    shouldDrop(
      exceptionEvent({
        type: "TypeError",
        value: "Loading chunk 123 failed",
        frames: [
          {
            filename: "https://www.frizeo.ro/_next/static/chunks/app/page.js",
          },
        ],
      }),
    ),
    false,
  );
});

test("KEEP: window.webkit.messageHandlers is not filtered by message alone", () => {
  assert.equal(
    shouldDrop(
      exceptionEvent({
        type: "TypeError",
        value:
          "undefined is not an object (evaluating 'window.webkit.messageHandlers')",
        frames: [{ filename: "https://www.frizeo.ro/frizerii/demo" }],
        browserName: "Mobile Safari",
      }),
    ),
    false,
  );
});

test("DROP: Firefox iOS injected window.__firefox__.reader with no first-party frames", () => {
  assert.equal(
    shouldDrop(
      exceptionEvent({
        type: "TypeError",
        value:
          "undefined is not an object (evaluating 'window.__firefox__.reader')",
        frames: [{ filename: "webkit-masked-url://hidden/" }],
      }),
    ),
    true,
  );
});

test("DROP: Firefox iOS Can't find variable: __firefox__ with no first-party frames", () => {
  assert.equal(
    shouldDrop(
      exceptionEvent({
        type: "ReferenceError",
        value: "Can't find variable: __firefox__",
      }),
    ),
    true,
  );
});

test("KEEP: __firefox__ message with a first-party Frizeo frame", () => {
  assert.equal(
    shouldDrop(
      exceptionEvent({
        type: "TypeError",
        value:
          "undefined is not an object (evaluating 'window.__firefox__.reader')",
        frames: [
          { filename: "lib/hooks/useBooking.ts", function: "useBooking" },
        ],
      }),
    ),
    false,
  );
});

test("KEEP: Facebook browser name is never enough to drop", () => {
  assert.equal(
    shouldDrop(
      exceptionEvent({
        type: "TypeError",
        value: "undefined is not an object",
        frames: [
          {
            filename: "app/components/BookingForm.tsx",
            function: "submitBooking",
          },
        ],
        browserName: "Facebook",
      }),
    ),
    false,
  );
});

test("app:// WebView schemes are not treated as first-party app/ paths", () => {
  assert.equal(
    shouldDrop(
      exceptionEvent({
        value: "Error invoking postMessage: Java object is gone",
        frames: [
          { filename: "app://navigation_performance_logger_android" },
        ],
      }),
    ),
    true,
  );
});

test("shared Sentry beforeSend wires the narrow browser-noise filter", () => {
  const source = readFileSync(join(root, "lib/sentry/shared.ts"), "utf8");
  assert.match(source, /shouldDropExternalBrowserNoise\(event\)/);
  assert.match(source, /return null;/);

  const ignoreBlock = source.match(/ignoreErrors:\s*\[([\s\S]*?)\],/)?.[1] ?? "";
  assert.match(ignoreBlock, /ResizeObserver loop/);
  assert.doesNotMatch(ignoreBlock, /Load failed/);
  assert.doesNotMatch(ignoreBlock, /Failed to fetch/);
  assert.doesNotMatch(ignoreBlock, /Network request failed/);
  assert.doesNotMatch(ignoreBlock, /NetworkError/);
  assert.doesNotMatch(ignoreBlock, /Loading chunk/);
  assert.doesNotMatch(ignoreBlock, /postMessage/);
  assert.doesNotMatch(ignoreBlock, /Unexpected end of input/);
});
