import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { getActiveDeletionRequest } from "@/lib/account-deletion/createRequest";
import { ACCOUNT_DELETION_PRODUCTION_DB_CODE } from "@/lib/account-deletion/decisions";
import { loadOwnershipTransferBlocks } from "@/lib/account-deletion/ownership";
import { accountDeletionWritesAreAllowed } from "@/lib/account-deletion/runtimeGuard";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [request, ownershipBlocks] = await Promise.all([
    getActiveDeletionRequest(user.id),
    loadOwnershipTransferBlocks(user.id),
  ]);

  const writesAllowed = accountDeletionWritesAreAllowed();
  return NextResponse.json({
    writesAllowed,
    code: writesAllowed ? undefined : ACCOUNT_DELETION_PRODUCTION_DB_CODE,
    request: request
      ? {
          id: request.id,
          status: request.status,
          scheduled_for: request.scheduled_for,
          requested_at: request.requested_at,
          reason: request.reason,
          failure_reason: request.failure_reason,
        }
      : null,
    ownership: {
      blocked: ownershipBlocks.length > 0,
      tenants: ownershipBlocks,
    },
  });
}
