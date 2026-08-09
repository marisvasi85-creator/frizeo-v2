import { NextResponse } from "next/server";
import { assertEmailApiAccess } from "@/lib/frizeo-email/access";
import {
  CONTACT_UUID_PATTERN,
  MAX_CONSENT_BULK_CONTACTS,
  setMarketingContactConsent,
} from "@/lib/frizeo-email/contactConsent";

export async function POST(request: Request) {
  const auth = await assertEmailApiAccess();
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalid." }, { status: 400 });
  }

  if (typeof body.marketing_consent !== "boolean") {
    return NextResponse.json(
      { error: "Marketing consent trebuie să fie Yes sau No." },
      { status: 400 },
    );
  }

  if (!Array.isArray(body.contact_ids)) {
    return NextResponse.json(
      { error: "Selectează cel puțin un contact." },
      { status: 400 },
    );
  }

  const contactIds = [
    ...new Set(
      body.contact_ids.filter(
        (value): value is string =>
          typeof value === "string" && CONTACT_UUID_PATTERN.test(value),
      ),
    ),
  ];

  if (
    contactIds.length === 0 ||
    contactIds.length !== body.contact_ids.length ||
    contactIds.length > MAX_CONSENT_BULK_CONTACTS
  ) {
    return NextResponse.json(
      {
        error: `Selecția trebuie să conțină între 1 și ${MAX_CONSENT_BULK_CONTACTS} de contacte valide, fără duplicate.`,
      },
      { status: 400 },
    );
  }

  try {
    const results = await setMarketingContactConsent({
      contactIds,
      marketingConsent: body.marketing_consent,
      actionSource: "bulk_admin",
      changedBy: auth.userId,
    });
    const changed = results.filter((row) => row.result === "changed");
    const unchanged = results.filter((row) => row.result === "unchanged");
    const blockedUnsubscribe = results.filter(
      (row) => row.result === "blocked_unsubscribe_history",
    );
    const blockedSuppressed = results.filter(
      (row) => row.result === "blocked_suppressed_status",
    );
    const blocked = [...blockedUnsubscribe, ...blockedSuppressed];

    return NextResponse.json({
      success: true,
      requested: contactIds.length,
      changed: changed.length,
      unchanged: unchanged.length,
      blocked: blocked.length,
      blocked_unsubscribe: blockedUnsubscribe.length,
      blocked_suppressed: blockedSuppressed.length,
      missing: contactIds.length - results.length,
      blocked_contact_ids: blocked.map((row) => row.changed_contact_id),
    });
  } catch (error) {
    console.error(
      "[email-contact-consent] bulk update failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: "Nu am putut actualiza contactele selectate." },
      { status: 500 },
    );
  }
}
