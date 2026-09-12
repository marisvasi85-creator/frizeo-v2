import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  dictationErrorMessage,
  isMicrophoneAllowedByDocumentPolicy,
} from "../app/admin/components/useSpeechDictation.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("Permissions-Policy allows same-origin microphone for assistant dictation", () => {
  const source = readFileSync(join(root, "next.config.ts"), "utf8");
  assert.match(source, /key:\s*"Permissions-Policy"/);
  assert.match(
    source,
    /value:\s*"camera=\(\), microphone=\(self\), geolocation=\(self\)"/,
  );
  assert.doesNotMatch(source, /value:\s*"[^"]*microphone=\(\)[^"]*"/);
});

test("dictationErrorMessage maps SpeechRecognition codes", () => {
  assert.equal(dictationErrorMessage("aborted"), null);
  assert.equal(dictationErrorMessage("no-speech"), null);
  assert.match(dictationErrorMessage("not-allowed"), /microfon/i);
  assert.match(dictationErrorMessage("service-not-allowed"), /lacătul/i);
  assert.match(dictationErrorMessage("audio-capture"), /microfon/i);
  assert.match(dictationErrorMessage("network"), /din nou/i);
});

test("isMicrophoneAllowedByDocumentPolicy follows Permissions-Policy", () => {
  assert.equal(isMicrophoneAllowedByDocumentPolicy(null), true);
  assert.equal(isMicrophoneAllowedByDocumentPolicy({}), true);
  assert.equal(
    isMicrophoneAllowedByDocumentPolicy({
      permissionsPolicy: { allowsFeature: (feature) => feature !== "microphone" },
    }),
    false,
  );
  assert.equal(
    isMicrophoneAllowedByDocumentPolicy({
      permissionsPolicy: { allowsFeature: (feature) => feature === "microphone" },
    }),
    true,
  );
  assert.equal(
    isMicrophoneAllowedByDocumentPolicy({
      featurePolicy: { allowsFeature: (feature) => feature === "microphone" },
    }),
    true,
  );
});
