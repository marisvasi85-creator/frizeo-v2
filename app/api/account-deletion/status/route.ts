import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { getActiveDeletionRequest } from "@/lib/account-deletion/createRequest";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const request = await getActiveDeletionRequest(user.id);
  if (!request) {
    return NextResponse.json({ request: null });
  }

  return NextResponse.json({
    request: {
      id: request.id,
      status: request.status,
      scheduled_for: request.scheduled_for,
      requested_at: request.requested_at,
      reason: request.reason,
    },
  });
}
