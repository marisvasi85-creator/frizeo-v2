import { NextResponse } from "next/server";
import {
  isAuthError,
  requireTenantAccess,
} from "@/lib/auth/requireTenantAccess";
import { listBookingsForAdmin } from "@/lib/bookings/listBookingsForAdmin";

export async function GET() {
  const auth = await requireTenantAccess(["owner", "manager", "barber"]);

  if (isAuthError(auth)) {
    return auth;
  }

  const { bookings, error } = await listBookingsForAdmin({
    userId: auth.user.id,
    tenantId: auth.tenantId,
    role: auth.role,
  });

  if (error) {
    console.error("bookings/list:", error);
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ bookings });
}
