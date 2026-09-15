import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { cancelAccountDeletionRequest } from "@/lib/account-deletion/cancelRequest";

export async function POST() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await cancelAccountDeletionRequest({
    actorUserId: user.id,
  });

  if (!result.ok) return result.response;

  return NextResponse.json({
    success: true,
    request: {
      id: result.request.id,
      status: result.request.status,
      cancelled_at: result.request.cancelled_at,
    },
  });
}
