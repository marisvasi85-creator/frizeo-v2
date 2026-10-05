import { isPlatformCreatorEmail } from "@/lib/auth/requirePlatformCreator";

export function canAdministerIntegrations(role: string | null | undefined): boolean {
  return role === "owner" || role === "manager";
}

export function canAccessIntegrationLab(
  email: string | null | undefined,
): boolean {
  return isPlatformCreatorEmail(email);
}
