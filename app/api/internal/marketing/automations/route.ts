import { NextResponse } from "next/server";
import { getEmailAppUrlForRequest } from "@/lib/frizeo-email/config";
import {
  isAuthorizedMarketingWorker,
  isMarketingWorkerConfigured,
} from "@/lib/frizeo-email/workerAuth";
import { processAutomationDiscoverAndExecute } from "@/lib/frizeo-email/automationWorker";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * External cron endpoint for Frizeo Email automations.
 * Auth: MARKETING_WORKER_SECRET (same internal marketing worker secret).
 *
 * Modes:
 * - ?mode=all (default): discover due triggers + execute due runs
 * - ?mode=discover: only create scheduled runs
 * - ?mode=execute: only claim/send due runs
 */
export async function GET(request: Request) {
  if (!isMarketingWorkerConfigured()) {
    return NextResponse.json(
      { error: "Marketing worker is not configured." },
      { status: 503 },
    );
  }

  if (!isAuthorizedMarketingWorker(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mode = new URL(request.url).searchParams.get("mode") || "all";
  const discover = mode === "all" || mode === "discover";
  const execute = mode === "all" || mode === "execute";

  try {
    const result = await processAutomationDiscoverAndExecute({
      emailAppUrl: getEmailAppUrlForRequest(request.url),
      discover,
      execute,
    });
    return NextResponse.json({ success: true, mode, ...result });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unknown worker error";
    console.error("[marketing-automation-worker] failed", {
      name: error instanceof Error ? error.name : "WorkerError",
      message: detail,
    });
    return NextResponse.json(
      {
        error: "Marketing automation worker failed.",
        detail,
      },
      { status: 500 },
    );
  }
}
