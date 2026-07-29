import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron/isAuthorizedCron";
import { getPlanIdBySlug } from "@/lib/billing/getPlanIdBySlug";
import { enforcePlanSeatLimits } from "@/lib/billing/enforcePlanSeatLimits";
import { PLAN_SLUGS } from "@/lib/billing/plans";

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date().toISOString();
    const freePlanId = await getPlanIdBySlug(PLAN_SLUGS.FREE);

    if (!freePlanId) {
      return NextResponse.json(
        { error: "Plan Free negăsit în baza de date." },
        { status: 500 },
      );
    }

    const { data: expiredTrials } = await supabaseAdmin
      .from("subscriptions")
      .select("tenant_id")
      .eq("status", "trialing")
      .is("stripe_subscription_id", null)
      .lt("trial_ends_at", now);

    if (!expiredTrials?.length) {
      return NextResponse.json({ success: true, updated: 0 });
    }

    const tenantIds = expiredTrials.map((s) => s.tenant_id);

    const { data } = await supabaseAdmin
      .from("subscriptions")
      .update({
        status: "active",
        plan_id: freePlanId,
        trial_ends_at: null,
      })
      .eq("status", "trialing")
      .is("stripe_subscription_id", null)
      .lt("trial_ends_at", now)
      .select();

    await supabaseAdmin
      .from("notification_settings")
      .update({
        booking_sms_enabled: false,
        reminder_sms_enabled: false,
        reschedule_sms_enabled: false,
        cancel_sms_enabled: false,
      })
      .in("tenant_id", tenantIds);

    let deactivated = 0;
    let invitesDeleted = 0;
    for (const tenantId of tenantIds) {
      const result = await enforcePlanSeatLimits(tenantId, 1, {
        clearPendingInvites: true,
      });
      deactivated += result.deactivatedBarberIds.length;
      invitesDeleted += result.deletedPendingInvites;
    }

    return NextResponse.json({
      success: true,
      updated: data?.length || 0,
      deactivatedBarbers: deactivated,
      deletedPendingInvites: invitesDeleted,
    });
  } catch (e) {
    console.error(e);

    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
