import { NextResponse } from "next/server";
import { skipBackgroundJobsIfDisabled } from "@/lib/app/backgroundJobs";
import { isAuthorizedCron } from "@/lib/cron/isAuthorizedCron";
import { runMarketingRetention } from "@/lib/integrations/marketingRetentionRun";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const skipped = skipBackgroundJobsIfDisabled(request, "cron-marketing-retention");
  if (skipped) return skipped;
  const result = await runMarketingRetention();
  return NextResponse.json({ success: result.outcome !== "failed", ...result });
}
