import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import { confirmAccountDeletionPassword } from "@/lib/account-deletion/confirmPassword";
import { createAccountDeletionRequest } from "@/lib/account-deletion/createRequest";

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { password?: unknown; reason?: unknown; reasonDetails?: unknown } = {};
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

  const session = await getAdminSession();
  const result = await createAccountDeletionRequest({
    req,
    userId: user.id,
    email: user.email,
    tenantId: session?.tenantId ?? null,
    reason: body.reason,
    reasonDetails: body.reasonDetails,
  });

  if (!result.ok) return result.response;

  return NextResponse.json({
    success: true,
    request: {
      id: result.request.id,
      status: result.request.status,
      scheduled_for: result.request.scheduled_for,
      requested_at: result.request.requested_at,
    },
  });
}
