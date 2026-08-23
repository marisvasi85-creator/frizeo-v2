import "server-only";

const DEFAULT_ANALYTICS_OWNERS = ["marisvasi85@gmail.com"];

export function getAnalyticsOwnerEmails(): string[] {
  const configured = process.env.ANALYTICS_OWNER_EMAILS?.trim();
  if (!configured) return DEFAULT_ANALYTICS_OWNERS;
  const emails = configured
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return emails.length > 0 ? emails : DEFAULT_ANALYTICS_OWNERS;
}

export function isAnalyticsOwnerEmail(
  email: string | null | undefined,
): boolean {
  if (!email) return false;
  return getAnalyticsOwnerEmails().includes(email.trim().toLowerCase());
}
