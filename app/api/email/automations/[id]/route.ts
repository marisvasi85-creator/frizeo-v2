import { NextResponse } from "next/server";
import { assertEmailApiAccess } from "@/lib/frizeo-email/access";
import {
  getAutomation,
  listAutomationRuns,
  setAutomationActive,
} from "@/lib/frizeo-email/automations";
import type { MarketingAutomationRunStatus } from "@/lib/frizeo-email/types";

type Params = Promise<{ id: string }>;

export async function GET(
  request: Request,
  context: { params: Params },
) {
  const auth = await assertEmailApiAccess();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const status =
    (new URL(request.url).searchParams.get("status") as
      | MarketingAutomationRunStatus
      | "all"
      | null) || "all";

  try {
    const automation = await getAutomation(id);
    if (!automation) {
      return NextResponse.json({ error: "Automation not found." }, { status: 404 });
    }
    const runs = await listAutomationRuns({
      automationId: id,
      status,
      limit: 100,
    });
    return NextResponse.json({ automation, runs });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nu am putut încărca automation.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Params },
) {
  const auth = await assertEmailApiAccess();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  let body: { is_active?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalid." }, { status: 400 });
  }

  if (typeof body.is_active !== "boolean") {
    return NextResponse.json(
      { error: "is_active boolean is required." },
      { status: 400 },
    );
  }

  try {
    const automation = await setAutomationActive(id, body.is_active);
    return NextResponse.json({ automation });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nu am putut actualiza automation.",
      },
      { status: 500 },
    );
  }
}
