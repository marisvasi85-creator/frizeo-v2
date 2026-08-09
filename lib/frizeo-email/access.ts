import { cache } from "react";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import {
  isPlatformAdminEmail,
  requirePlatformAdmin,
} from "@/lib/auth/requirePlatformAdmin";
import { syncPlatformAdminMembership } from "@/lib/auth/platformAdminSync";

export type EmailSession =
  | { ok: true; userId: string; email: string }
  | { ok: false; reason: "unauthenticated" | "forbidden" };

/**
 * Cached platform-admin session for Frizeo Email layouts/pages.
 */
export const getEmailSession = cache(async (): Promise<EmailSession> => {
  const user = await getAuthUser();
  if (!user) return { ok: false, reason: "unauthenticated" };

  const email = user.email?.trim().toLowerCase() || "";
  if (!isPlatformAdminEmail(email)) {
    return { ok: false, reason: "forbidden" };
  }

  await syncPlatformAdminMembership({ userId: user.id, email });
  return { ok: true, userId: user.id, email };
});

export async function assertEmailApiAccess() {
  return requirePlatformAdmin();
}
