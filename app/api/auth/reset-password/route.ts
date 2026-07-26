import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isValidEmail, normalizeEmail } from "@/lib/auth/credentials";
import { getAppUrl } from "@/lib/app/getAppUrl";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export async function POST(req: Request) {
  const { email } = await req.json();
  const limited = await enforceRateLimit(req, {
    bucket: "auth-reset-password",
    identifier: normalizeEmail(email || ""),
    limit: 5,
    windowSeconds: 60 * 60,
  });
  if (limited) return limited;

  if (!isValidEmail(email || "")) {
    return NextResponse.json({ error: "Email invalid." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.resetPasswordForEmail(
    normalizeEmail(email),
    {
      redirectTo: `${getAppUrl()}/auth/callback?next=/reset-password`,
    }
  );

  if (error) {
    return NextResponse.json(
      { error: "Nu am putut trimite emailul de resetare." },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
