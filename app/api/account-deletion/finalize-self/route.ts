import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { confirmAccountDeletionPassword } from "@/lib/account-deletion/confirmPassword";
import { getActiveDeletionRequest } from "@/lib/account-deletion/createRequest";
import {
  claimAccountDeletionById,
  finalizeAccountDeletion,
} from "@/lib/account-deletion/finalize";
import { OWNERSHIP_TRANSFER_REQUIRED } from "@/lib/account-deletion/decisions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  hostnameFromRequest,
  isStagingHostname,
} from "@/lib/app/environment";

export async function POST(req: Request) {
  if (!isStagingHostname(hostnameFromRequest(req))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await getAuthUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { password?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const confirmed = await confirmAccountDeletionPassword({
    sessionEmail: user.email,
    password: body.password,
  });
  if (!confirmed.ok) return confirmed.response;

  const active = await getActiveDeletionRequest(user.id);
  if (!active || active.status !== "pending") {
    return NextResponse.json(
      { error: "Nu există o solicitare pending de ștergere." },
      { status: 409 },
    );
  }

  const { error: dueError } = await supabaseAdmin
    .from("account_deletion_requests")
    .update({ scheduled_for: new Date().toISOString() })
    .eq("id", active.id)
    .eq("user_id", user.id)
    .eq("status", "pending");
  if (dueError) {
    console.error("account deletion mark due", dueError);
    return NextResponse.json(
      { error: "Nu am putut marca solicitarea ca scadentă." },
      { status: 500 },
    );
  }

  const claimed = await claimAccountDeletionById(active.id);
  if (!claimed) {
    return NextResponse.json(
      { error: "Solicitarea nu a putut fi preluată." },
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
          "Finalizarea este blocată până transferi ownership-ul unui alt membru.",
        code: OWNERSHIP_TRANSFER_REQUIRED,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true, request: result.request });
}
