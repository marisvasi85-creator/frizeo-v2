import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { mapAuthError } from "@/lib/auth/credentials";

/**
 * Re-auth with the existing email+password login. The session email is used;
 * the client cannot inject another user_id.
 */
export async function confirmAccountDeletionPassword(input: {
  sessionEmail: string;
  password: unknown;
}): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  if (typeof input.password !== "string" || input.password.length < 1) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Parola este obligatorie pentru confirmare." },
        { status: 400 },
      ),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: input.sessionEmail,
    password: input.password,
  });

  if (error) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: mapAuthError(error.message) },
        { status: 400 },
      ),
    };
  }

  return { ok: true };
}
