import { NextResponse } from "next/server";
import { skipBackgroundJobsIfDisabled } from "@/lib/app/backgroundJobs";
import { isAuthorizedCron } from "@/lib/cron/isAuthorizedCron";
import { runDueAccountDeletions } from "@/lib/account-deletion/finalize";

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const skipped = skipBackgroundJobsIfDisabled(req, "cron-account-deletion");
  if (skipped) return skipped;

  try {
    const result = await runDueAccountDeletions(5);
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("ACCOUNT DELETION CRON", err);
    return NextResponse.json({ error: "Account deletion cron failed" }, { status: 500 });
  }
}
