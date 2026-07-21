import { cache } from "react";
import { getAdminSession } from "@/lib/auth/getAdminSession";

/**
 * Current user's barber row in the active tenant.
 * Deduped with getAdminSession() per request.
 */
export const getCurrentBarberInTenant = cache(async () => {
  const session = await getAdminSession();
  // Preserve the loose barber shape used across admin/API callers.
  return (session?.barber as Record<string, any> | null) ?? null;
});
