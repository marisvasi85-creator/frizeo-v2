import { supabaseAdmin } from "@/lib/supabase/admin";
import { canUserCancelRequest } from "@/lib/account-deletion/decisions";
import { sendAccountDeletionCancelledEmail } from "@/lib/account-deletion/emails";
import { accountDeletionWriteBlockResponse } from "@/lib/account-deletion/runtimeGuard";
import {
  ACCOUNT_DELETION_SELECT,
  type AccountDeletionRequestRow,
} from "@/lib/account-deletion/types";
import { NextResponse } from "next/server";

export async function cancelAccountDeletionRequest(input: {
  requestId?: string;
  actorUserId: string;
  asAdmin?: boolean;
  hostname?: string | null;
}): Promise<
  | { ok: true; request: AccountDeletionRequestRow }
  | { ok: false; response: NextResponse }
> {
  const blocked = accountDeletionWriteBlockResponse(input.hostname);
  if (blocked) {
    return { ok: false, response: blocked };
  }

  let query = supabaseAdmin
    .from("account_deletion_requests")
    .select(ACCOUNT_DELETION_SELECT)
    .eq("status", "pending");

  if (input.requestId) {
    query = query.eq("id", input.requestId);
  } else {
    query = query.eq("user_id", input.actorUserId);
  }

  const { data, error } = await query
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("account deletion cancel load", error);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Nu am putut anula solicitarea." },
        { status: 500 },
      ),
    };
  }

  const request = (data as AccountDeletionRequestRow | null) ?? null;
  if (!request) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Nu există o solicitare de ștergere activă." },
        { status: 404 },
      ),
    };
  }

  if (!input.asAdmin && !canUserCancelRequest(request, input.actorUserId)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("account_deletion_requests")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      claim_token: null,
      claimed_at: null,
    })
    .eq("id", request.id)
    .eq("status", "pending")
    .select(ACCOUNT_DELETION_SELECT)
    .maybeSingle();

  if (updateError || !updated) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Solicitarea nu mai poate fi anulată." },
        { status: 409 },
      ),
    };
  }

  const cancelled = updated as AccountDeletionRequestRow;
  if (!cancelled.cancel_email_sent_at) {
    try {
      await sendAccountDeletionCancelledEmail(cancelled.email_snapshot);
      await supabaseAdmin
        .from("account_deletion_requests")
        .update({ cancel_email_sent_at: new Date().toISOString() })
        .eq("id", cancelled.id);
    } catch (err) {
      console.error("account deletion cancel email", err);
    }
  }

  return { ok: true, request: cancelled };
}
