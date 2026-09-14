import { ACCOUNT_DELETION_GRACE_DAYS } from "@/lib/account-deletion/constants";
import { isPlatformCreatorEmail } from "@/lib/auth/requirePlatformCreator";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import {
  ACCOUNT_DELETION_PRODUCTION_BLOCK_MESSAGE,
  hasActiveDeletionRequest,
  isMissingAccountDeletionTableError,
  parseOptionalReason,
} from "@/lib/account-deletion/decisions";
import { accountDeletionWriteBlockResponse } from "@/lib/account-deletion/runtimeGuard";
import { sendAccountDeletionRequestedEmail } from "@/lib/account-deletion/emails";
import {
  ACCOUNT_DELETION_SELECT,
  type AccountDeletionRequestRow,
} from "@/lib/account-deletion/types";
import { NextResponse } from "next/server";

export async function getActiveDeletionRequest(
  userId: string,
): Promise<AccountDeletionRequestRow | null> {
  const { data, error } = await supabaseAdmin
    .from("account_deletion_requests")
    .select(ACCOUNT_DELETION_SELECT)
    .eq("user_id", userId)
    .in("status", ["pending", "processing"])
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("account deletion load active", error);
    // Missing table (staging app still on production DB) must not crash /admin/account.
    return null;
  }

  return (data as AccountDeletionRequestRow | null) ?? null;
}

export async function createAccountDeletionRequest(input: {
  req: Request;
  userId: string;
  email: string | null;
  tenantId: string | null;
  reason?: unknown;
  reasonDetails?: unknown;
}): Promise<
  | { ok: true; request: AccountDeletionRequestRow }
  | { ok: false; response: NextResponse }
> {
  if (!input.email) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Contul nu are o adresă de email." },
        { status: 400 },
      ),
    };
  }

  if (isPlatformCreatorEmail(input.email)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Contul creator Frizeo nu poate fi șters din dashboard." },
        { status: 403 },
      ),
    };
  }

  const limited = await enforceRateLimit(input.req, {
    bucket: "account-deletion-request",
    identifier: input.userId,
    limit: 5,
    windowSeconds: 60 * 60,
  });
  if (limited) return { ok: false, response: limited };

  const blocked = accountDeletionWriteBlockResponse();
  if (blocked) {
    return { ok: false, response: blocked };
  }

  const parsed = parseOptionalReason({
    reason: input.reason,
    reasonDetails: input.reasonDetails,
  });
  if (!parsed.ok) {
    return {
      ok: false,
      response: NextResponse.json({ error: parsed.error }, { status: 400 }),
    };
  }

  const existing = await getActiveDeletionRequest(input.userId);
  if (hasActiveDeletionRequest(existing ? [existing] : [])) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Există deja o solicitare de ștergere activă." },
        { status: 409 },
      ),
    };
  }

  const { data, error } = await supabaseAdmin
    .from("account_deletion_requests")
    .insert({
      user_id: input.userId,
      tenant_id: input.tenantId,
      email_snapshot: input.email.trim().toLowerCase(),
      reason: parsed.reason,
      reason_details: parsed.reasonDetails,
      status: "pending",
      requested_at: new Date().toISOString(),
      scheduled_for: new Date(
        Date.now() + ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString(),
    })
    .select(ACCOUNT_DELETION_SELECT)
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Există deja o solicitare de ștergere activă." },
          { status: 409 },
        ),
      };
    }
    if (isMissingAccountDeletionTableError(error)) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: ACCOUNT_DELETION_PRODUCTION_BLOCK_MESSAGE,
            code: "schema_missing",
          },
          { status: 409 },
        ),
      };
    }
    console.error("account deletion insert", error);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Nu am putut programa ștergerea contului." },
        { status: 500 },
      ),
    };
  }

  const request = data as AccountDeletionRequestRow;

  try {
    await sendAccountDeletionRequestedEmail({
      to: request.email_snapshot,
      scheduledFor: request.scheduled_for,
    });
    await supabaseAdmin
      .from("account_deletion_requests")
      .update({ request_email_sent_at: new Date().toISOString() })
      .eq("id", request.id);
  } catch (err) {
    console.error("account deletion request email", err);
  }

  return { ok: true, request };
}
