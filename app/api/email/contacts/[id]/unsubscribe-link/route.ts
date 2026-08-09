import { NextResponse } from "next/server";
import { assertEmailApiAccess } from "@/lib/frizeo-email/access";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  buildUnsubscribeUrl,
  ensureUnsubscribeToken,
} from "@/lib/frizeo-email/unsubscribe";

type Params = Promise<{ id: string }>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Generate a fresh public unsubscribe link for platform-admin testing. */
export async function POST(
  _request: Request,
  { params }: { params: Params },
) {
  const auth = await assertEmailApiAccess();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Contact invalid." }, { status: 400 });
  }

  const { data: contact, error } = await supabaseAdmin
    .from("marketing_contacts")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Nu am putut verifica acest contact." },
      { status: 500 },
    );
  }
  if (!contact) {
    return NextResponse.json({ error: "Contact inexistent." }, { status: 404 });
  }

  try {
    const token = await ensureUnsubscribeToken(contact.id);
    return NextResponse.json({ url: buildUnsubscribeUrl(token) });
  } catch (tokenError) {
    console.error(
      "[email-unsubscribe-link] generation failed:",
      tokenError instanceof Error ? tokenError.message : tokenError,
    );
    return NextResponse.json(
      { error: "Nu am putut genera linkul de test." },
      { status: 500 },
    );
  }
}
