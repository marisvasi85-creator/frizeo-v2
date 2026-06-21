import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAuthorizedCron } from "@/lib/cron/isAuthorizedCron";

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
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