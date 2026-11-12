import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { DEMO_BARBER_TENANT_ID } from "../lib/integrations/tiktok/draftTest.ts";
import {
  tikTokDraftReviewAvailable,
  tikTokDraftReviewMessage,
} from "../lib/integrations/tiktok/draftReview.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const demoUser = "5edac115-6694-4917-ab04-0c02cd7e2f77";

const ready = {
  production: false,
  staging: true,
  tenantId: DEMO_BARBER_TENANT_ID,
  role: "owner",
  userId: demoUser,
  connectedBy: demoUser,
  status: "connected",
  scopes: ["user.info.basic", "video.upload"],
  gateEnabled: true,
};

test("the review button is limited to the staging demo account with upload consent", () => {
  assert.equal(tikTokDraftReviewAvailable(ready), true);
  assert.equal(tikTokDraftReviewAvailable({ ...ready, production: true }), false);
  assert.equal(tikTokDraftReviewAvailable({ ...ready, staging: false }), false);
  assert.equal(tikTokDraftReviewAvailable({ ...ready, gateEnabled: false }), false);
  assert.equal(tikTokDraftReviewAvailable({
    ...ready,
    tenantId: "11111111-1111-1111-1111-111111111111",
  }), false);
  assert.equal(tikTokDraftReviewAvailable({ ...ready, role: "barber" }), false);
  assert.equal(tikTokDraftReviewAvailable({ ...ready, userId: "22222222-2222-2222-2222-222222222222" }), false);
  assert.equal(tikTokDraftReviewAvailable({ ...ready, scopes: ["user.info.basic"] }), false);
  assert.equal(tikTokDraftReviewAvailable({
    ...ready,
    scopes: ["user.info.basic", "video.upload", "video.publish"],
  }), false);
});

test("the confirmation says the material was sent and does not claim a published post", () => {
  const sent = tikTokDraftReviewMessage({ outcome: "initiated" });
  assert.match(sent, /trimis ca draft în TikTok/);
  assert.match(sent, /Nu este publicat/);
  assert.doesNotMatch(sent, /a fost publicat|postare publică|Direct Post/i);
  for (const message of [
    tikTokDraftReviewMessage({ outcome: "replay" }),
    tikTokDraftReviewMessage({ outcome: "needs_reconcile" }),
    tikTokDraftReviewMessage({ outcome: "rejected" }),
    tikTokDraftReviewMessage({ error: "gate_off" }),
    tikTokDraftReviewMessage({}),
  ]) {
    assert.doesNotMatch(message, /(?<!nu )a fost publicat|postare publică/i);
  }
});

test("the review screen reuses the draft adapter and does not enable direct posting", () => {
  const client = read("app/admin/marketing-ai/MarketingAIClient.tsx");
  const imageRoute = read("app/api/integrations/tiktok/draft-image/route.ts");
  const handlers = read("lib/integrations/tiktok/draftHandlers.ts");
  const review = read("lib/integrations/tiktok/draftReview.ts");
  assert.match(client, /Trimite ca draft în TikTok/);
  assert.match(client, /\/api\/integrations\/tiktok\/draft-image/);
  assert.match(client, /\/api\/integrations\/tiktok\/draft/);
  assert.doesNotMatch(client, /video\.publish|marketing\.publish\.tiktok/);
  assert.match(imageRoute, /storeTikTokDraftImage/);
  assert.doesNotMatch(imageRoute, /open\.tiktokapis|performTikTokDraftTest|video\.publish/);
  assert.match(handlers, /uploadTikTokDraftJpeg/);
  assert.match(handlers, /performTikTokDraftTest/);
  assert.match(review, /!scopes\.has\("video\.publish"\)/);
  assert.doesNotMatch(review, /marketing\.publish\.tiktok|draftTest|next\/headers/);
  assert.doesNotMatch(read("lib/integrations/tiktok/demoTenant.ts"), /import /);
  assert.doesNotMatch(read("lib/integrations/tiktok/config.ts"), /TIKTOK_DIRECT_POST_ENABLED = true/);
  assert.doesNotMatch(read("lib/integrations/tiktok/config.ts"), /TIKTOK_CONTENT_POSTING_LIVE = true/);
});
