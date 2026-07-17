import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import {
  listBarbersForAdmin,
  listBookingsForAdmin,
} from "@/lib/bookings/listBookingsForAdmin";
import type { TenantRole } from "@/lib/auth/tenantRole";
import type { BookingRow } from "@/lib/bookings/groupBookingsForList";
import BookingsClient from "./BookingsClient";

export default async function AdminBookingsPage() {
  const session = await getAdminSession();
  if (!session?.tenantId || !session.role) {
    redirect("/login");
  }

  const [{ bookings, error: bookingsError }, { barbers }] = await Promise.all([
    listBookingsForAdmin({
      userId: session.user.id,
      tenantId: session.tenantId,
      role: session.role as TenantRole,
    }),
    listBarbersForAdmin(session.tenantId),
  ]);

  return (
    <BookingsClient
      initialBookings={bookings as BookingRow[]}
      initialBarbers={barbers}
      initialError={bookingsError || ""}
    />
  );
}
