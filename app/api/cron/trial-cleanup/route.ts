import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron/isAuthorizedCron";

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
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