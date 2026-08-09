import { NextResponse } from "next/server";
import { getEmailAppUrlForRequest } from "@/lib/frizeo-email/config";
import {
  isAuthorizedMarketingWorker,
  isMarketingWorkerConfigured,
} from "@/lib/frizeo-email/workerAuth";
import { processMarketingBatch } from "@/lib/frizeo-email/worker";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isMarketingWorkerConfigured()) {
    return NextResponse.json(
      { error: "Marketing worker is not configured." },
      { status: 503 },
    );
  }

  if (!isAuthorizedMarketingWorker(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      {
        status: 401,
        headers: { "WWW-Authenticate": "Bearer" },
      },
    );
  }

  try {
    const result = await processMarketingBatch({
      emailAppUrl: getEmailAppUrlForRequest(request.url),
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[marketing-worker] batch failed", {
      name: error instanceof Error ? error.name : "WorkerError",
      message: error instanceof Error ? error.message : "Unknown worker error",
    });
    return NextResponse.json(
      { error: "Marketing worker failed." },
      { status: 500 },
    );
  }
}
