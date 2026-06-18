import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { email } = await req.json();

  console.log(
    "REDIRECT TEST:",
    "https://frizeo.ro/reset-password"
  );

  const supabase =
    await createSupabaseServerClient();

  const { error } =
    await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo:
          "https://frizeo.ro/reset-password",
      }
    );

  console.log("RESET ERROR:", error);

  return NextResponse.json({
    success: !error,
    error: error?.message,
  });
}