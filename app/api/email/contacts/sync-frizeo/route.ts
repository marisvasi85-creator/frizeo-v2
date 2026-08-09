import { NextResponse } from "next/server";
import { assertEmailApiAccess } from "@/lib/frizeo-email/access";
import { syncFrizeoOwnerContacts } from "@/lib/frizeo-email/contacts";

/** Import tenant owners as contacts without granting marketing consent. */
export async function POST() {
  const auth = await assertEmailApiAccess();
  if (!auth.ok) return auth.response;

  try {
    const result = await syncFrizeoOwnerContacts();
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync eșuat.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
