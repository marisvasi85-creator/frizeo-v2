import { NextResponse } from "next/server";
import { skipBackgroundJobsIfDisabled } from "@/lib/app/backgroundJobs";
import { isAuthorizedCron } from "@/lib/cron/isAuthorizedCron";
import { isBookingNotificationOutboxEnabled } from "@/lib/bookings/notificationOutboxConfig";
import { processBookingNotificationBatch } from "@/lib/bookings/notificationOutboxWorker";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isBookingNotificationOutboxEnabled()) {
    return NextResponse.json({ success: true, skipped: "feature-disabled" });
  }
  const skipped = skipBackgroundJobsIfDisabled(
    request,
    "booking-notification-worker",
  );
  if (skipped) return skipped;

  try {
    const result = await processBookingNotificationBatch({ limit: 12 });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[booking-notification-worker] batch failed", error);
    return NextResponse.json(
      { error: "Booking notification worker failed." },
      { status: 500 },
    );
  }
}
