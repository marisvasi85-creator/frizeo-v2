import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  isRetentionMediaPath,
  marketingRetentionDays,
  readRetentionCandidates,
  retentionFilePaths,
} from "../lib/integrations/marketingRetention.ts";
import {
  issueMetaDeletionCode,
  metaDeletionStatus,
  readMetaSignedRequest,
  signMetaRequest,
} from "../lib/integrations/meta/signedRequest.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const secret = "meta-app-secret-for-tests";

test("meta signed requests reject a bad signature and another user's payload", () => {
  const signed = signMetaRequest({ user_id: "1234567890" }, secret);
  assert.deepEqual(readMetaSignedRequest(signed, secret), { ok: true, userId: "1234567890" });
  assert.equal(readMetaSignedRequest(signed, "other-secret").ok, false);
  const [signature, payload] = signed.split(".");
  const tampered = Buffer.from(JSON.stringify({
    algorithm: "HMAC-SHA256",
    user_id: "999",
  }), "utf8").toString("base64url");
  assert.equal(readMetaSignedRequest(`${signature}.${tampered}`, secret).ok, false);
  assert.equal(readMetaSignedRequest(`not-a-signature.${payload}`, secret).ok, false);
  const wrongAlgorithm = Buffer.from(JSON.stringify({
    algorithm: "PLAINTEXT",
    user_id: "1234567890",
  }), "utf8").toString("base64url");
  const wrongSignature = createHmac("sha256", secret).update(wrongAlgorithm).digest("base64url");
  assert.equal(readMetaSignedRequest(`${wrongSignature}.${wrongAlgorithm}`, secret).ok, false);
});

test("meta deletion status hides the removal count and expires", () => {
  const code = issueMetaDeletionCode({
    appSecret: secret,
    removed: 0,
    issuedAt: 1_700_000_000,
    nonce: "a".repeat(16),
  });
  assert.equal(typeof code, "string");
  assert.equal(code.includes("1234567890"), false);
  assert.deepEqual(metaDeletionStatus(code, secret, 1_700_000_100), { ok: true, issuedAt: 1_700_000_000 });
  assert.equal(metaDeletionStatus(code, secret, 1_700_000_000 + 60 * 60 * 24 * 31).ok, false);
  assert.equal(metaDeletionStatus(code, "other-secret", 1_700_000_100).ok, false);
});

test("marketing retention stays off unless the operator sets a bounded day count", () => {
  assert.equal(marketingRetentionDays({}), null);
  assert.equal(marketingRetentionDays({ MARKETING_DATA_RETENTION_DAYS: "" }), null);
  assert.equal(marketingRetentionDays({ MARKETING_DATA_RETENTION_DAYS: "0" }), null);
  assert.equal(marketingRetentionDays({ MARKETING_DATA_RETENTION_DAYS: "90" }), 90);
  assert.equal(marketingRetentionDays({ MARKETING_DATA_RETENTION_DAYS: "3651" }), null);
  assert.equal(isRetentionMediaPath("tenant/file.jpg"), false);
  const path = "5d9862a1-fd85-46f2-9c7e-635e813e067c/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg";
  const candidates = readRetentionCandidates({
    outcome: "ready",
    assets: [{ id: "asset-1", path }, { id: "asset-2", path: "../secret.jpg" }],
    orphans: [path, "notes.txt"],
  });
  assert.deepEqual(retentionFilePaths(candidates), [path]);
  assert.equal(readRetentionCandidates({ outcome: "rejected", assets: [], orphans: [] }), null);
});

test("review controls do not publish and isolate the meta user deletion", () => {
  const sql = readFileSync(
    join(root, "supabase/migrations/20261115102955_frizeo_v2_marketing_review_controls.sql"),
    "utf8",
  );
  assert.match(sql, /provider = 'meta'/);
  assert.match(sql, /not exists/);
  assert.match(sql, /p_days < 1 or p_days > 3650/);
  assert.equal(sql.includes("mybusiness.googleapis.com"), false);
  assert.equal(sql.includes("graph.facebook.com"), false);
  const callback = readFileSync(join(root, "lib/integrations/meta/reviewCallbacks.ts"), "utf8");
  assert.equal(callback.includes("publishLocalPost"), false);
  assert.equal(callback.includes("open.tiktokapis.com"), false);
  assert.match(callback, /meta_disconnect_provider_user/);
  const cron = readFileSync(join(root, "app/api/cron/marketing-retention/route.ts"), "utf8");
  assert.match(cron, /isAuthorizedCron/);
  assert.match(cron, /skipBackgroundJobsIfDisabled/);
});
