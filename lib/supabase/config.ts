import {
  isProductionHostname,
  isStagingHostname,
} from "@/lib/app/environment";
import {
  serviceRoleCanAccessUrl,
  STAGING_SUPABASE_URL,
} from "@/lib/account-deletion/decisions";

export {
  STAGING_SUPABASE_PROJECT_REF,
  STAGING_SUPABASE_URL,
  shouldUseStagingSupabaseFrom,
  serviceRoleMatchesUrl,
  supabaseProjectRefFromJwt,
} from "@/lib/account-deletion/decisions";

/** Public staging anon key. Safe to ship in the client bundle. */
export const STAGING_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhbnh4eXRmdWhuYWtmZHp3c3NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNTI5MTEsImV4cCI6MjEwMDYyODkxMX0.0jVhLpUJewbtdpjphtxwuyoKzaFBjKtKHPkKwHRGmLg";

let requestHostnameHint: string | null = null;

export function noteRequestHostname(hostname?: string | null): void {
  const normalized = (hostname ?? "").split(":")[0]?.trim().toLowerCase() ?? "";
  requestHostnameHint = normalized || null;
}

function resolvedHostname(hostname?: string | null): string | null {
  if (hostname) return hostname;
  if (typeof window !== "undefined") return window.location.hostname;
  return requestHostnameHint;
}

export function shouldUseStagingSupabase(hostname?: string | null): boolean {
  const host = resolvedHostname(hostname);
  if (isProductionHostname(host)) return false;
  // Hostname only. Git branch / APP_URL would flip Staging during `next build`
  // prerender (no Host header) and break Vercel on missing Staging tables.
  return isStagingHostname(host);
}

export function getSupabaseUrl(hostname?: string | null): string {
  if (hostname) noteRequestHostname(hostname);
  if (shouldUseStagingSupabase(hostname)) {
    return process.env.STAGING_SUPABASE_URL?.trim() || STAGING_SUPABASE_URL;
  }
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
}

export function getSupabaseAnonKey(hostname?: string | null): string {
  if (shouldUseStagingSupabase(hostname)) {
    return (
      process.env.STAGING_SUPABASE_ANON_KEY?.trim() || STAGING_SUPABASE_ANON_KEY
    );
  }
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
}

export function getSupabaseServiceRoleKey(): string {
  if (shouldUseStagingSupabase()) {
    return (
      process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
      ""
    );
  }
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
}

export function canUseServiceRoleAdmin(): boolean {
  return serviceRoleCanAccessUrl({
    supabaseUrl: getSupabaseUrl(),
    serviceRoleKey: getSupabaseServiceRoleKey(),
    envSupabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
}
