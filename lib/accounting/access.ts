import { isPlatformCreatorEmail } from "@/lib/auth/requirePlatformCreator";

export type AccountingAccess =
  | { ok: true; email: string }
  | { ok: false; status: 401 | 403; error: "Unauthorized" | "Forbidden" };

/**
 * Același allowlist ca operațiunile sensibile de platformă (`requirePlatformCreator`).
 * Salon owner / frizer nu are acces la încasările tuturor tenant-urilor.
 */
export function accountingAccessForUser(
  user: { email?: string | null } | null,
): AccountingAccess {
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };
  const email = user.email?.trim().toLowerCase() || "";
  if (!email || !isPlatformCreatorEmail(email)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return { ok: true, email };
}
