import { NextResponse } from "next/server";
import { assertEmailApiAccess } from "@/lib/frizeo-email/access";
import {
  CONTACT_UUID_PATTERN,
  setMarketingContactConsent,
} from "@/lib/frizeo-email/contactConsent";
import { deleteMarketingContacts } from "@/lib/frizeo-email/contacts";

type Params = Promise<{ id: string }>;

export async function PATCH(
  request: Request,
  { params }: { params: Params },
) {
  const auth = await assertEmailApiAccess();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!CONTACT_UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Contact invalid." }, { status: 400 });
  }

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

  try {
    const results = await setMarketingContactConsent({
      contactIds: [id],
      marketingConsent: body.marketing_consent,
      actionSource: "manual_admin",
      changedBy: auth.userId,
    });
    const result = results[0];

    if (!result) {
      return NextResponse.json(
        { error: "Contact inexistent." },
        { status: 404 },
      );
    }

    if (result.result === "blocked_unsubscribe_history") {
      return NextResponse.json(
        {
          error:
            "Contactul are istoric de dezabonare și nu poate fi reactivat prin Edit Contact.",
          code: "unsubscribe_history",
        },
        { status: 409 },
      );
    }

    if (result.result === "blocked_suppressed_status") {
      return NextResponse.json(
        {
          error:
            "Contactul este suprimat după bounce permanent sau complaint și nu poate fi reactivat din Edit Contact.",
          code: "suppressed_contact",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      result: result.result,
      marketing_consent: result.current_marketing_consent,
    });
  } catch (error) {
    console.error(
      "[email-contact-consent] update failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: "Nu am putut actualiza consimțământul." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Params },
) {
  const auth = await assertEmailApiAccess();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!CONTACT_UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Contact invalid." }, { status: 400 });
  }

  try {
    const deleted = await deleteMarketingContacts([id], auth.userId);
    if (deleted === 0) {
      return NextResponse.json({ error: "Contact inexistent sau deja șters." }, { status: 404 });
    }
    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error("[email-contact] delete failed", error);
    return NextResponse.json(
      { error: "Nu am putut șterge contactul." },
      { status: 500 },
    );
  }
}
