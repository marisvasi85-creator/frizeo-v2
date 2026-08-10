import { NextResponse } from "next/server";
import { assertEmailApiAccess } from "@/lib/frizeo-email/access";
import { deleteMarketingContacts } from "@/lib/frizeo-email/contacts";
import { CONTACT_UUID_PATTERN } from "@/lib/frizeo-email/contactConsent";

export async function POST(request: Request) {
  const auth = await assertEmailApiAccess();
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalid." }, { status: 400 });
  }

  const ids = Array.isArray(body.contact_ids)
    ? [...new Set(body.contact_ids)]
    : [];
  if (
    ids.length < 1 ||
    ids.length > 200 ||
    ids.some((id) => typeof id !== "string" || !CONTACT_UUID_PATTERN.test(id))
  ) {
    return NextResponse.json(
      { error: "Selecția trebuie să conțină între 1 și 200 de contacte valide, fără duplicate." },
      { status: 400 },
    );
  }

  try {
    const deleted = await deleteMarketingContacts(ids as string[], auth.userId);
    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error("[email-contacts] bulk delete failed", error);
    return NextResponse.json(
      { error: "Nu am putut șterge contactele selectate." },
      { status: 500 },
    );
  }
}
