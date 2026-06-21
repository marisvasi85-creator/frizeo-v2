import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isValidEmail,
  isValidPassword,
  mapAuthError,
  normalizeEmail,
  PASSWORD_REQUIREMENTS_MESSAGE,
} from "@/lib/auth/credentials";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!isValidEmail(email || "")) {
      return NextResponse.json({ error: "Email invalid." }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json(
        { error: "Parola este obligatorie." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: mapAuthError(error?.message) },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Eroare server. Încearcă din nou." },
      { status: 500 }
    );
  }
}
