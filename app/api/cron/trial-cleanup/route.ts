import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

    const now =
      new Date().toISOString();

    const { data } =
      await supabaseAdmin
        .from("subscriptions")
        .update({
          status: "active",
        })
        .eq("status", "trialing")
        .lt("trial_ends_at", now)
        .select();

    return NextResponse.json({
      success: true,
      updated:
        data?.length || 0,
    });

  } catch (e) {

    console.error(e);

    return NextResponse.json(
      { error: "Cron failed" },
      { status: 500 }
    );
  }
}