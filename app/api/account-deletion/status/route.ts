import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { getActiveDeletionRequest } from "@/lib/account-deletion/createRequest";
import { loadOwnershipTransferBlocks } from "@/lib/account-deletion/ownership";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [request, ownershipBlocks] = await Promise.all([
    getActiveDeletionRequest(user.id),
    loadOwnershipTransferBlocks(user.id),
  ]);

  return NextResponse.json({
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
