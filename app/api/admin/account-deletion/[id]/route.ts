import { NextResponse } from "next/server";
import { requirePlatformCreator } from "@/lib/auth/requirePlatformCreator";
import { cancelAccountDeletionRequest } from "@/lib/account-deletion/cancelRequest";
import { loadOwnershipTransferBlocks } from "@/lib/account-deletion/ownership";
import { OWNERSHIP_TRANSFER_REQUIRED } from "@/lib/account-deletion/decisions";
import {
  claimAccountDeletionById,
  finalizeAccountDeletion,
} from "@/lib/account-deletion/finalize";
import {
  isDevelopment,
  isPreview,
  isProduction,
  isStaging,
} from "@/lib/app/environment";
import { simulateExpiryAllowed } from "@/lib/account-deletion/decisions";
import { supabaseAdmin } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const auth = await requirePlatformCreator();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let action = "";
  try {
    const body = await req.json();
    action = typeof body?.action === "string" ? body.action : "";
  } catch {
    action = "";
  }

  if (action === "cancel") {
    const result = await cancelAccountDeletionRequest({
      requestId: id,
      actorUserId: auth.userId,
      asAdmin: true,
    });
    if (!result.ok) return result.response;
    return NextResponse.json({ success: true, request: result.request });
  }

  if (action === "delete_now") {
    const { data: existing } = await supabaseAdmin
      .from("account_deletion_requests")
      .select("id, user_id, status")
      .eq("id", id)
      .maybeSingle();

    if (existing?.user_id) {
      const blocks = await loadOwnershipTransferBlocks(existing.user_id);
      if (blocks.length > 0) {
        return NextResponse.json(
          {
            error:
              "Finalizarea este blocată până când owner-ul transferă ownership-ul unui alt membru.",
            code: OWNERSHIP_TRANSFER_REQUIRED,
            tenants: blocks,
          },
          { status: 409 },
        );
      }
    }

    const claimed = await claimAccountDeletionById(id);
    if (!claimed) {
      return NextResponse.json(
        { error: "Solicitarea nu este pending sau este deja preluată." },
        { status: 409 },
      );
    }
    const result = await finalizeAccountDeletion(claimed);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Finalizarea a eșuat." },
        { status: 500 },
      );
    }
    if (result.skipped && result.reason === OWNERSHIP_TRANSFER_REQUIRED) {
      return NextResponse.json(
        {
          error:
            "Finalizarea este blocată până când owner-ul transferă ownership-ul unui alt membru.",
          code: OWNERSHIP_TRANSFER_REQUIRED,
          request: result.request,
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ success: true, request: result.request });
  }

  if (action === "simulate_expiry") {
    if (
      !simulateExpiryAllowed({
        isProduction: isProduction(),
        isStaging: isStaging(),
        isDevelopment: isDevelopment(),
        isPreview: isPreview(),
      })
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from("account_deletion_requests")
      .update({ scheduled_for: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending")
      .select("id, scheduled_for, status")
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { error: "Nu am putut simula expirarea." },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, request: data });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
