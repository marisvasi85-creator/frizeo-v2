import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const body = await req.json();

    const { barberId, active } = body;

    if (!barberId || typeof active !== "boolean") {
      return NextResponse.json(
        { error: "Date invalide" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("barbers")
      .update({
        active,
      })
      .eq("id", barberId);

    if (error) {
      console.error(error);

      return NextResponse.json(
        { error: "Update failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });

  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}