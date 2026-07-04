import { getAppUrl } from "@/lib/app/getAppUrl";

export function getGoogleOAuthRedirectUri(): string {
  return `${getAppUrl()}/api/google/callback`;
}
