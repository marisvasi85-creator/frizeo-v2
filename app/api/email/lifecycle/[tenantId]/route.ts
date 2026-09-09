import { NextResponse } from "next/server";
import { assertEmailApiAccess } from "@/lib/frizeo-email/access";
import {
  classifyTenantLifecycle,
  updateTenantOutreach,
} from "@/lib/frizeo-email/lifecycleAdmin";

type Params = Promise<{ tenantId: string }>;

export async function PATCH(
  request: Request,
  context: { params: Params },
) {
  const auth = await assertEmailApiAccess();
  if (!auth.ok) return auth.response;

  const { tenantId } = await context.params;
  try {
    const body = (await request.json()) as {
      outreach_status?: string;
      unused_reason?: string | null;
      refresh?: boolean;
    };
    if (body.refresh) {
      const state = await classifyTenantLifecycle(tenantId);
      return NextResponse.json({ state });
    }
    await updateTenantOutreach({
      tenantId,
      outreachStatus: body.outreach_status,
      unusedReason: body.unused_reason,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Nu am putut actualiza salonul.",
      },
      { status: 500 },
    );
  }
}
