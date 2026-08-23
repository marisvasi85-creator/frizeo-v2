import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CLIENT_ACCESS_APPROVED_SUBJECT,
  clientAccessApprovedEmailHtml,
} from "../lib/barber-access/clientApprovalNotification.ts";
import {
  ACCESS_REQUEST_TOKEN_TTL_MS,
  accessRequestQuickApprovalUrl,
  createAccessRequestToken,
  hashAccessRequestToken,
  quickApprovalOutcomeMessage,
  resolveQuickApprovalViewState,
} from "../lib/barber-access/quickApprovalToken.ts";
import { publicBookingUrl } from "../lib/booking/publicBookingPath.ts";

const root = new URL("../", import.meta.url);
const readSource = (path) => readFile(new URL(path, root), "utf8");

test("quick approval tokens are random, hashed and expire after seven days", () => {
  const now = new Date("2026-08-23T10:00:00.000Z");
  const generated = Array.from({ length: 32 }, () =>
    createAccessRequestToken(now),
  );

  assert.equal(new Set(generated.map((item) => item.token)).size, 32);
  assert.equal(new Set(generated.map((item) => item.tokenHash)).size, 32);
  for (const item of generated) {
    assert.match(item.token, /^[A-Za-z0-9_-]{43}$/);
    assert.match(item.tokenHash, /^[0-9a-f]{64}$/);
    assert.notEqual(item.token, item.tokenHash);
    assert.equal(hashAccessRequestToken(item.token), item.tokenHash);
    assert.equal(
      new Date(item.expiresAt).getTime() - now.getTime(),
      ACCESS_REQUEST_TOKEN_TTL_MS,
    );
  }
  assert.equal(ACCESS_REQUEST_TOKEN_TTL_MS, 7 * 24 * 60 * 60 * 1000);
  assert.equal(hashAccessRequestToken("not-a-valid-token"), null);
});

test("the quick URL contains only the opaque token as authorization data", () => {
  const { token } = createAccessRequestToken();
  const result = accessRequestQuickApprovalUrl(
    token,
    "https://staging.frizeo.ro",
  );
  const url = new URL(result);

  assert.equal(url.origin, "https://staging.frizeo.ro");
  assert.equal(url.pathname, "/access-request");
  assert.deepEqual([...url.searchParams.keys()], ["token"]);
  assert.equal(url.searchParams.get("token"), token);
  assert.doesNotMatch(result, /barber|phone|email|client/i);
});

test("GET view states preserve processed decisions and reject expired or used pending tokens", () => {
  const now = new Date("2026-08-23T10:00:00.000Z");
  const future = "2026-08-30T10:00:00.000Z";
  const past = "2026-08-22T10:00:00.000Z";

  assert.equal(
    resolveQuickApprovalViewState({ status: "pending", expiresAt: future, now }),
    "pending",
  );
  assert.equal(
    resolveQuickApprovalViewState({ status: "pending", expiresAt: past, now }),
    "unavailable",
  );
  assert.equal(
    resolveQuickApprovalViewState({
      status: "pending",
      expiresAt: future,
      usedAt: "2026-08-23T09:00:00.000Z",
      now,
    }),
    "unavailable",
  );
  assert.equal(
    resolveQuickApprovalViewState({ status: "approved", expiresAt: past, now }),
    "already_approved",
  );
  assert.equal(
    resolveQuickApprovalViewState({ status: "rejected", expiresAt: future, now }),
    "rejected",
  );
  assert.equal(
    resolveQuickApprovalViewState({ status: "blocked", expiresAt: future, now }),
    "blocked",
  );
});

test("public copy is neutral for invalid links and explicit for processed requests", () => {
  assert.equal(
    quickApprovalOutcomeMessage("already_approved").title,
    "Client deja acceptat",
  );
  assert.equal(
    quickApprovalOutcomeMessage("rejected").title,
    "Cererea nu mai este în așteptare",
  );
  assert.equal(
    quickApprovalOutcomeMessage("blocked").title,
    "Cererea nu mai poate fi acceptată din acest link.",
  );
  assert.equal(
    quickApprovalOutcomeMessage("invalid").title,
    quickApprovalOutcomeMessage("expired").title,
  );
  assert.doesNotMatch(
    quickApprovalOutcomeMessage("invalid").message,
    /token|request_id|barber_id/i,
  );
});

test("client approval email uses the correct barber booking URL and escapes content", () => {
  const bookingUrl = publicBookingUrl(
    "salon-demo",
    "frizer-b",
    "https://staging.frizeo.ro",
  );
  const html = clientAccessApprovedEmailHtml({
    clientName: "Ana <Client>",
    barberName: "Frizer & B",
    bookingUrl,
  });

  assert.equal(CLIENT_ACCESS_APPROVED_SUBJECT, "Cererea ta a fost acceptată");
  assert.equal(
    bookingUrl,
    "https://staging.frizeo.ro/booking/salon/salon-demo/frizer-b",
  );
  assert.match(html, /Programează-te/);
  assert.match(html, /booking\/salon\/salon-demo\/frizer-b/);
  assert.match(html, /Ana &lt;Client&gt;/);
  assert.match(html, /Frizer &amp; B/);
  assert.doesNotMatch(html, /Ana <Client>/);
});

test("GET is read-only and only the explicit POST route calls the accept RPC wrapper", async () => {
  const [page, card, postRoute] = await Promise.all([
    readSource("app/access-request/page.tsx"),
    readSource("app/access-request/QuickApprovalCard.tsx"),
    readSource("app/api/public/barber-access/accept/route.ts"),
  ]);

  assert.match(page, /getQuickApprovalView\(token\)/);
  assert.doesNotMatch(page, /acceptQuickApprovalToken|\.update\(|\.rpc\(/);
  assert.match(card, /method: "POST"/);
  assert.match(card, /Acceptă clientul/);
  assert.match(postRoute, /export async function POST/);
  assert.match(postRoute, /acceptQuickApprovalToken\(token\)/);
  assert.doesNotMatch(postRoute, /export async function GET/);
});

test("migration enforces hash-only, service-role access and atomic status priority", async () => {
  const sql = await readSource(
    "supabase/migrations/20260823115806_barber_access_quick_approval.sql",
  );
  const blockedCheck = sql.indexOf("v_access.status = 'blocked'");
  const approvalUpdate = sql.indexOf("UPDATE public.barber_client_access a", blockedCheck);

  assert.match(
    sql,
    /access_request_sms_enabled boolean NOT NULL DEFAULT true/,
  );
  assert.match(sql, /token_hash text NOT NULL UNIQUE/);
  assert.doesNotMatch(sql, /raw_token\s+text|token_plain|plain_token/i);
  assert.match(sql, /request_id uuid PRIMARY KEY/);
  assert.match(sql, /REFERENCES public\.barber_client_access\(id\)/);
  assert.match(sql, /expires_at timestamptz NOT NULL/);
  assert.match(sql, /used_at timestamptz/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON TABLE[\s\S]*FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT ALL ON TABLE[\s\S]*TO service_role/);
  assert.match(sql, /SECURITY INVOKER/g);
  assert.match(sql, /SET search_path = ''/g);
  assert.match(sql, /FOR UPDATE/g);
  assert.ok(blockedCheck >= 0 && approvalUpdate > blockedCheck);
  assert.match(sql, /AND a\.status = 'pending'/);
  assert.match(sql, /decision_source = 'quick_link'/);
  assert.match(sql, /SET used_at = now\(\)/);
  assert.match(sql, /approval_notification_claimed_at IS NULL/);
  assert.match(sql, /GRANT EXECUTE[\s\S]*TO service_role/g);
  assert.match(sql, /FROM PUBLIC, anon, authenticated/g);
});

test("a token is bound to its exact request and cannot select another barber/client", async () => {
  const sql = await readSource(
    "supabase/migrations/20260823115806_barber_access_quick_approval.sql",
  );
  const acceptFunction = sql.slice(
    sql.indexOf("CREATE OR REPLACE FUNCTION public.accept_barber_access_request_token"),
    sql.indexOf("CREATE OR REPLACE FUNCTION public.claim_barber_access_approval_notification"),
  );

  assert.match(acceptFunction, /WHERE t\.token_hash = p_token_hash/);
  assert.match(acceptFunction, /WHERE a\.id = v_token\.request_id/);
  assert.match(acceptFunction, /WHERE a\.id = v_access\.id/);
  assert.match(acceptFunction, /AND a\.barber_id = v_access\.barber_id/);
  assert.match(acceptFunction, /AND a\.tenant_id = v_access\.tenant_id/);
  assert.doesNotMatch(acceptFunction, /p_barber_id|p_client_id|p_request_id/);
});

test("sensitive quick links are excluded from analytics and client notifications are claimed once", async () => {
  const [analytics, dashboardRoute, quickRoute] = await Promise.all([
    readSource("app/components/analytics/AnalyticsProvider.tsx"),
    readSource("app/api/barber-access/clients/actions/route.ts"),
    readSource("app/api/public/barber-access/accept/route.ts"),
  ]);

  assert.match(analytics, /pathname === "\/access-request"/);
  assert.match(analytics, /if \(isSensitiveRoute[\s\S]*return null/);
  assert.match(dashboardRoute, /notifyClientAccessApprovedOnce/);
  assert.match(quickRoute, /notifyClientAccessApprovedOnce/);
  assert.match(quickRoute, /result\.outcome === "approved"/);
});
