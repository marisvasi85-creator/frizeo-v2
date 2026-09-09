import { NextResponse } from "next/server";
import { assertEmailApiAccess } from "@/lib/frizeo-email/access";
import {
  getLifecycleFunnel,
  getLifecycleSettings,
  listLifecycleTenants,
  updateLifecycleSettings,
} from "@/lib/frizeo-email/lifecycleAdmin";

export async function GET(request: Request) {
  const auth = await assertEmailApiAccess();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const stage = url.searchParams.get("stage") || "all";
  const outreach = url.searchParams.get("outreach") || "all";

  try {
    const [settings, tenants, funnel] = await Promise.all([
      getLifecycleSettings(),
      listLifecycleTenants({ stage, outreach }),
      getLifecycleFunnel(),
    ]);
    return NextResponse.json({ settings, tenants, funnel });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Nu am putut încărca lifecycle.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await assertEmailApiAccess();
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as {
      enabled?: boolean;
      allow_existing_zero_booking_cohort?: boolean;
      test_contact_ids?: string[];
      notes?: string;
    };
    const settings = await updateLifecycleSettings({
      ...(typeof body.enabled === "boolean" ? { enabled: body.enabled } : {}),
      ...(typeof body.allow_existing_zero_booking_cohort === "boolean"
        ? {
            allow_existing_zero_booking_cohort:
              body.allow_existing_zero_booking_cohort,
          }
        : {}),
      ...(Array.isArray(body.test_contact_ids)
        ? { test_contact_ids: body.test_contact_ids }
        : {}),
      ...(typeof body.notes === "string" ? { notes: body.notes } : {}),
    });
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Nu am putut salva setările.",
      },
      { status: 500 },
    );
  }
}
