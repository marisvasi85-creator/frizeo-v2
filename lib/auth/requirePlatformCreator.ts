import { getAuthUser } from "@/lib/auth/getAuthUser";
import { NextResponse } from "next/server";

const DEFAULT_CREATOR_EMAILS = ["marisvasi85@gmail.com"];

/**
 * Platform creator allowlist.
 * Override / extend with PLATFORM_CREATOR_EMAILS=a@x.com,b@y.com
 */
export function getPlatformCreatorEmails(): string[] {
  const fromEnv = process.env.PLATFORM_CREATOR_EMAILS?.trim();
  if (!fromEnv) return DEFAULT_CREATOR_EMAILS;

  const parsed = fromEnv
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : DEFAULT_CREATOR_EMAILS;
}

export function isPlatformCreatorEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return getPlatformCreatorEmails().includes(normalized);
}

export type PlatformCreatorAuth =
  | { ok: true; userId: string; email: string }
  | { ok: false; response: NextResponse };

/**
 * Auth gate for Frizeo platform (creator) APIs.
 * Does not use tenant scoping.
 */
export async function requirePlatformCreator(): Promise<PlatformCreatorAuth> {
  const user = await getAuthUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const email = user.email?.trim().toLowerCase() || null;
  if (!isPlatformCreatorEmail(email)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, userId: user.id, email: email! };
}
