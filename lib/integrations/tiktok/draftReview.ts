import { DEMO_BARBER_TENANT_ID } from "@/lib/integrations/tiktok/demoTenant";

const SENT_AS_DRAFT =
  "Materialul a fost trimis ca draft în TikTok. Nu este publicat. Continuă din notificarea din aplicația TikTok.";

export function tikTokDraftReviewAvailable(input: {
  production: boolean;
  staging: boolean;
  tenantId: string | null;
  role: string | null;
  userId: string | null;
  connectedBy: string | null;
  status: string | null;
  scopes: readonly string[];
  gateEnabled: boolean;
}): boolean {
  if (input.production || !input.staging || !input.gateEnabled) return false;
  if (input.tenantId !== DEMO_BARBER_TENANT_ID) return false;
  if (input.role !== "owner" && input.role !== "manager") return false;
  if (!input.userId || input.userId !== input.connectedBy) return false;
  if (input.status !== "connected") return false;
  const scopes = new Set(input.scopes);
  return scopes.has("user.info.basic")
    && scopes.has("video.upload")
    && !scopes.has("video.publish");
}

export function tikTokDraftReviewMessage(input: {
  outcome?: string | null;
  error?: string | null;
}): string {
  const error = input.error ?? "";
  const outcome = input.outcome ?? "";
  if (error === "not_configured") return "Trimiterea ca draft este disponibilă doar pe staging. Nu s-a trimis nimic.";
  if (error === "unauthenticated" || error === "forbidden") {
    return "Contul curent nu poate trimite acest draft. Nu s-a trimis nimic.";
  }
  if (error === "gate_off") return "Trimiterea de draft este oprită pe server. Nu s-a trimis nimic.";
  if (error === "upload_scope_required" || outcome === "upload_scope_required") {
    return "Contul TikTok nu are permisiunea video.upload. Nu s-a trimis nimic.";
  }
  if (
    error === "invalid"
    || error === "invalid_image"
    || error === "unsupported_type"
    || outcome === "invalid"
  ) {
    return "Imaginea sau textul nu au putut fi pregătite. Nu s-a trimis nimic.";
  }
  if (error === "storage") return "Imaginea nu a putut fi salvată. Nu s-a trimis nimic către TikTok.";
  if (outcome === "initiated") return SENT_AS_DRAFT;
  if (outcome === "replay") {
    return "Acest draft a fost deja trimis în TikTok. Nu s-a făcut o trimitere nouă.";
  }
  if (outcome === "needs_reconcile") {
    return "TikTok a fost contactat, dar confirmarea locală nu este completă. Nu s-a trimis din nou.";
  }
  if (outcome === "busy") {
    return "Există deja un draft TikTok în curs pentru acest salon. Nu s-a trimis din nou.";
  }
  if (outcome === "rejected" || error === "provider_rejected") {
    return "TikTok a refuzat draftul. Materialul nu a fost publicat.";
  }
  return "Draftul nu a fost trimis. Nu s-a publicat nimic.";
}
