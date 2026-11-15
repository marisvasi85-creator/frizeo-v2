import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { hostnameFromRequest } from "@/lib/app/environment";
import {
  issueMetaDeletionCode,
  readMetaSignedRequest,
} from "@/lib/integrations/meta/signedRequest";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { supabaseAdmin } from "@/lib/supabase/admin";

const REVIEW_HOSTS = new Set(["staging.frizeo.ro", "www.frizeo.ro", "frizeo.ro"]);

export function metaReviewHost(request: Request): string | null {
  const host = hostnameFromRequest(request);
  return REVIEW_HOSTS.has(host) ? host : null;
}

async function signedUserId(request: Request): Promise<
  | { ok: true; userId: string; secret: string }
  | { ok: false; status: number; error: string }
> {
  const secret = process.env.META_APP_SECRET?.trim() ?? "";
  if (!secret) return { ok: false, status: 404, error: "not_configured" };
  const form = await request.formData().catch(() => null);
  const signed = form?.get("signed_request");
  if (typeof signed !== "string" || signed.length > 4096) {
    return { ok: false, status: 400, error: "invalid" };
  }
  const parsed = readMetaSignedRequest(signed, secret);
  if (!parsed.ok) return { ok: false, status: 400, error: "invalid" };
  return { ok: true, userId: parsed.userId, secret };
}

async function removeMetaUser(userId: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin.rpc("meta_disconnect_provider_user", {
    p_provider_user_id: userId,
  });
  const removed = data && typeof data === "object" ? (data as { removed?: unknown }).removed : null;
  if (error || typeof removed !== "number" || removed < 0) return null;
  return removed;
}

export async function deauthorizeMeta(request: Request) {
  if (!metaReviewHost(request)) {
    return NextResponse.json({ error: "not_configured" }, { status: 404 });
  }
  const limited = await enforceRateLimit(request, {
    bucket: "meta-deauthorize",
    limit: 30,
    windowSeconds: 600,
    identifier: "meta-deauthorize",
  });
  if (limited) return limited;
  const signed = await signedUserId(request);
  if (!signed.ok) return NextResponse.json({ error: signed.error }, { status: signed.status });
  const removed = await removeMetaUser(signed.userId);
  if (removed == null) return NextResponse.json({ error: "unavailable" }, { status: 500 });
  console.info(JSON.stringify({ source: "meta_deauthorize", removed: removed > 0 }));
  return NextResponse.json({ ok: true });
}

export async function deleteMetaUserData(request: Request) {
  const host = metaReviewHost(request);
  if (!host) return NextResponse.json({ error: "not_configured" }, { status: 404 });
  const limited = await enforceRateLimit(request, {
    bucket: "meta-data-deletion",
    limit: 30,
    windowSeconds: 600,
    identifier: "meta-data-deletion",
  });
  if (limited) return limited;
  const signed = await signedUserId(request);
  if (!signed.ok) return NextResponse.json({ error: signed.error }, { status: signed.status });
  const removed = await removeMetaUser(signed.userId);
  if (removed == null) return NextResponse.json({ error: "unavailable" }, { status: 500 });
  const code = issueMetaDeletionCode({
    appSecret: signed.secret,
    removed: 0,
    issuedAt: Math.floor(Date.now() / 1000),
    nonce: randomBytes(16).toString("base64url"),
  });
  if (!code) return NextResponse.json({ error: "unavailable" }, { status: 500 });
  console.info(JSON.stringify({ source: "meta_data_deletion", removed: removed > 0 }));
  return NextResponse.json({
    url: `https://${host}/stergere-date/meta/${code}`,
    confirmation_code: code,
  });
}
