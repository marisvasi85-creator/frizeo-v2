import { NextResponse } from "next/server";
import { shouldSkipBackgroundJobs } from "@/lib/app/environment";

export function skippedBackgroundJobsResponse(job: string) {
  console.info(`[${job}] skipped disabled_on_staging`);
  return NextResponse.json(
    {
      success: true,
      skipped: true,
      reason: "disabled_on_staging",
    },
    { status: 200 },
  );
}

export function skipBackgroundJobsIfDisabled(
  request: Request,
  job: string,
): NextResponse | null {
  if (!shouldSkipBackgroundJobs(request)) return null;
  return skippedBackgroundJobsResponse(job);
}
