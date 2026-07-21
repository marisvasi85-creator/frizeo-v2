import { cache } from "react";
import { getAdminSession } from "@/lib/auth/getAdminSession";

/**
 * Role for the active tenant. Deduped with getAdminSession() per request.
 */
export const getCurrentRole = cache(async () => {
  const session = await getAdminSession();
  return session?.role ?? null;
});
