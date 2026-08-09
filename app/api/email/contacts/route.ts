import { NextRequest, NextResponse } from "next/server";
import { assertEmailApiAccess } from "@/lib/frizeo-email/access";
import {
  createContact,
  listContacts,
} from "@/lib/frizeo-email/contacts";
import type {
  MarketingContactSource,
  MarketingContactStatus,
} from "@/lib/frizeo-email/types";
import { MARKETING_CONTACT_SOURCES } from "@/lib/frizeo-email/types";

export async function GET(req: NextRequest) {
  const auth = await assertEmailApiAccess();
  if (!auth.ok) return auth.response;

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q") || undefined;
  const status = (sp.get("status") || "all") as MarketingContactStatus | "all";
  const source = (sp.get("source") || "all") as MarketingContactSource | "all";
  const consent = (sp.get("consent") || "all") as "all" | "yes" | "no";
  const limit = Number(sp.get("limit") || 50);
  const offset = Number(sp.get("offset") || 0);

  try {
    const result = await listContacts(
      { q, status, source, consent },
      { limit, offset },
    );
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Eroare la listare.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await assertEmailApiAccess();
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalid." }, { status: 400 });
  }

  const sourceRaw = String(body.source || "manual");
  const source = (
    MARKETING_CONTACT_SOURCES.includes(sourceRaw as MarketingContactSource)
      ? sourceRaw
      : "manual"
  ) as MarketingContactSource;

  const result = await createContact({
    email: String(body.email || ""),
    first_name: body.first_name ? String(body.first_name) : null,
    last_name: body.last_name ? String(body.last_name) : null,
    phone: body.phone ? String(body.phone) : null,
    source,
    marketing_consent: Boolean(body.marketing_consent),
    consent_source: body.marketing_consent
      ? String(body.consent_source || "manual")
      : null,
    notes: body.notes ? String(body.notes) : null,
  });

  if (!result.ok) {
    const status =
      result.code === "duplicate" ? 409 : result.code === "invalid_email" ? 400 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ contact: result.contact }, { status: 201 });
}
