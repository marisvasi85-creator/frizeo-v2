import { getAuthUser } from "@/lib/auth/getAuthUser";
import { getPlatformCreatorEmails } from "@/lib/auth/requirePlatformCreator";
import { syncPlatformAdminMembership } from "@/lib/auth/platformAdminSync";
import { NextResponse } from "next/server";

const DEFAULT_PLATFORM_ADMIN_EMAILS = ["office@frizeo.ro"];

/**
 * Global Frizeo platform admins (not tenant salon owners).
 * PLATFORM_ADMIN_EMAILS overrides; falls back to creator emails + office@.
 */
export function getPlatformAdminEmails(): string[] {
  const fromEnv = process.env.PLATFORM_ADMIN_EMAILS?.trim();
  if (fromEnv) {
    const parsed = fromEnv
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (parsed.length > 0) return parsed;
  }

  return [
    ...new Set([
      ...getPlatformCreatorEmails(),
      ...DEFAULT_PLATFORM_ADMIN_EMAILS,
    ]),
  ];
}

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return getPlatformAdminEmails().includes(normalized);
}

export type PlatformAdminAuth =
  | { ok: true; userId: string; email: string }
  | { ok: false; response: NextResponse };

/**
 * Server-side gate for Frizeo Email / platform tooling.
 * Also syncs platform_admins row for RLS when allowlisted.
 */
export async function requirePlatformAdmin(): Promise<PlatformAdminAuth> {
  const user = await getAuthUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const email = user.email?.trim().toLowerCase() || null;
  if (!isPlatformAdminEmail(email)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  await syncPlatformAdminMembership({ userId: user.id, email: email! });

  return { ok: true, userId: user.id, email: email! };
}
