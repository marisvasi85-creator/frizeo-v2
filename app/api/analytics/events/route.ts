import { NextResponse } from "next/server";
import {
  FIRST_PARTY_EVENT_NAMES,
  type FirstPartyEventName,
} from "@/lib/analytics/firstParty";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENT_NAMES = new Set<string>(FIRST_PARTY_EVENT_NAMES);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BOT_PATTERN =
  /bot|crawler|spider|slurp|headless|lighthouse|pagespeed|facebookexternalhit|preview/i;

function stringValue(
  value: unknown,
  maxLength: number,
): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function safeProperties(
  value: unknown,
): Record<string, string | number | boolean | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output: Record<string, string | number | boolean | null> = {};
  for (const [rawKey, rawValue] of Object.entries(value).slice(0, 12)) {
    const key = rawKey.trim().slice(0, 60);
    if (!key) continue;
    if (typeof rawValue === "string") output[key] = rawValue.slice(0, 240);
    else if (
      typeof rawValue === "number" ||
      typeof rawValue === "boolean" ||
      rawValue === null
    ) {
      output[key] = rawValue;
    }
  }
  return output;
}

function requestComesFromFrizeo(req: Request): boolean {
  if (req.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "frizeo.ro" ||
      host.endsWith(".frizeo.ro") ||
      host.endsWith(".vercel.app")
    );
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!requestComesFromFrizeo(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userAgent = req.headers.get("user-agent") || "";
  if (BOT_PATTERN.test(userAgent)) {
    return NextResponse.json({ accepted: false }, { status: 202 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventId = stringValue(body.eventId, 36);
  const visitorId = stringValue(body.visitorId, 36);
  const sessionId = stringValue(body.sessionId, 36);
  const eventName = stringValue(body.eventName, 80);
  const path = stringValue(body.path, 500);

  if (
    !eventId ||
    !visitorId ||
    !sessionId ||
    !UUID_PATTERN.test(eventId) ||
    !UUID_PATTERN.test(visitorId) ||
    !UUID_PATTERN.test(sessionId) ||
    !eventName ||
    !EVENT_NAMES.has(eventName) ||
    !path ||
    !path.startsWith("/") ||
    body.consentGranted !== true
  ) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  const limited = await enforceRateLimit(req, {
    bucket: "analytics-events",
    identifier: visitorId,
    limit: 240,
    windowSeconds: 60 * 60,
  });
  if (limited) return limited;

  const source = stringValue(body.source, 120) || "direct";
  const properties = safeProperties(body.properties);
  if (JSON.stringify(properties).length > 2_048) {
    return NextResponse.json({ error: "Event too large" }, { status: 413 });
  }

  const { error } = await supabaseAdmin.from("marketing_traffic_events").upsert(
    {
      event_id: eventId,
      event_name: eventName as FirstPartyEventName,
      visitor_id: visitorId,
      session_id: sessionId,
      path,
      page_title: stringValue(body.pageTitle, 240),
      referrer_host: stringValue(body.referrerHost, 255),
      source,
      medium: stringValue(body.medium, 120),
      campaign: stringValue(body.campaign, 180),
      content: stringValue(body.content, 180),
      term: stringValue(body.term, 180),
      properties,
      consent_granted: true,
    },
    { onConflict: "event_id", ignoreDuplicates: true },
  );

  if (error) {
    console.error("[analytics-events] insert failed", error.message);
    return NextResponse.json(
      { error: "Analytics temporarily unavailable" },
      { status: 503 },
    );
  }

  return NextResponse.json({ accepted: true }, { status: 202 });
}
