import { createHash, randomBytes } from "node:crypto";

export const ACCESS_REQUEST_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RAW_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type QuickApprovalOutcome =
  | "approved"
  | "already_approved"
  | "rejected"
  | "blocked"
  | "expired"
  | "invalid";

export type QuickApprovalViewState =
  | "pending"
  | "already_approved"
  | "rejected"
  | "blocked"
  | "unavailable";

export function hashAccessRequestToken(token: string): string | null {
  if (!RAW_TOKEN_PATTERN.test(token)) return null;
  return createHash("sha256").update(token).digest("hex");
}

export function createAccessRequestToken(now = new Date()): {
  token: string;
  tokenHash: string;
  expiresAt: string;
} {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashAccessRequestToken(token);

  if (!tokenHash) {
    throw new Error("Could not generate a valid access request token");
  }

  return {
    token,
    tokenHash,
    expiresAt: new Date(now.getTime() + ACCESS_REQUEST_TOKEN_TTL_MS).toISOString(),
  };
}

export function accessRequestQuickApprovalUrl(
  token: string,
  appUrl: string,
): string {
  const url = new URL("/access-request", appUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export function resolveQuickApprovalViewState(input: {
  status: string;
  expiresAt: string;
  usedAt?: string | null;
  now?: Date;
}): QuickApprovalViewState {
  if (input.status === "approved") return "already_approved";
  if (input.status === "rejected") return "rejected";
  if (input.status === "blocked") return "blocked";
  if (input.status !== "pending") return "unavailable";
  if (input.usedAt) return "unavailable";

  const expiresAt = new Date(input.expiresAt).getTime();
  const now = (input.now ?? new Date()).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now
    ? "pending"
    : "unavailable";
}

export function quickApprovalOutcomeMessage(outcome: QuickApprovalOutcome): {
  title: string;
  message: string;
} {
  switch (outcome) {
    case "approved":
      return {
        title: "Client acceptat",
        message: "Clientul se poate programa acum la tine.",
      };
    case "already_approved":
      return {
        title: "Client deja acceptat",
        message: "Acest client are deja acces la programările tale.",
      };
    case "rejected":
      return {
        title: "Cererea nu mai este în așteptare",
        message: "Poți administra clientul din Frizeo.",
      };
    case "blocked":
      return {
        title: "Cererea nu mai poate fi acceptată din acest link.",
        message: "Poți administra clientul din Frizeo.",
      };
    case "expired":
    case "invalid":
      return {
        title: "Linkul nu mai este disponibil",
        message: "Deschide Frizeo pentru a verifica cererile în așteptare.",
      };
  }
}
