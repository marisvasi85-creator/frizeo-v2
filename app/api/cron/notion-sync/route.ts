import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron/isAuthorizedCron";
import { getNotionToken } from "@/lib/notion/client";
import { syncSmsUsageToNotion } from "@/lib/notion/syncSmsUsage";
import { syncSaloaneToNotion } from "@/lib/notion/syncSaloane";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!getNotionToken()) {
    return NextResponse.json(
      { error: "NOTION_TOKEN is not configured" },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(req.url);
  const daysBack = Number(searchParams.get("days") || "7");
  const only = searchParams.get("only"); // sms | saloane | null

  try {
    const result: Record<string, unknown> = { success: true };

    if (!only || only === "sms") {
      result.sms = await syncSmsUsageToNotion({
        daysBack: Number.isFinite(daysBack) ? daysBack : 7,
      });
    }

    if (!only || only === "saloane") {
      result.saloane = await syncSaloaneToNotion();
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("NOTION SYNC ERROR:", err);
    return NextResponse.json(
      {
        error: "Notion sync failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
