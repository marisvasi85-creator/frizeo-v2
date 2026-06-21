import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {

  const { searchParams } =
    new URL(req.url);

  if (
    searchParams.get("secret") !==
    process.env.CRON_SECRET
  ) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const supabase = await createSupabaseServerClient();

    const now = new Date().toISOString();

    // 🔥 ȘTERGE DOAR HOLD-URI EXPIRATE
    const { error } = await supabase
      .from("bookings")
      .delete()
      .eq("status", "pending")
      .lt("expires_at", now);

    if (error) {
      console.error("CLEANUP ERROR:", error);

      return NextResponse.json(
        { error: "Cleanup failed" },
        { status: 500 }
      );
    }

    console.log("CLEANUP OK");

    return NextResponse.json({
      success: true,
    });

  } catch (err) {
    console.error("CLEANUP CRASH:", err);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}