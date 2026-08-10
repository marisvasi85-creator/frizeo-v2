import { isValidEmail, normalizeEmail } from "@/lib/auth/credentials";
import type { MarketingEmailContent } from "@/lib/frizeo-email/types";

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(value: unknown): string | null {
  const parsed = stringValue(value);
  return parsed || null;
}

export function isSafePublicUrl(value: string | null): boolean {
  if (!value) return true;
  if (value === "{{booking_link}}") return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function parseEmailContent(
  body: Record<string, unknown>,
): { ok: true; value: MarketingEmailContent } | { ok: false; error: string } {
  const value: MarketingEmailContent = {
    subject: stringValue(body.subject),
    preview_text: stringValue(body.preview_text),
    heading: stringValue(body.heading),
    body_text: typeof body.body_text === "string" ? body.body_text.trim() : "",
    image_url: optionalString(body.image_url),
    cta_text: optionalString(body.cta_text),
    cta_url: optionalString(body.cta_url),
    footer_text:
      typeof body.footer_text === "string" ? body.footer_text.trim() : "",
  };

  if (value.subject.length > 200) {
    return { ok: false, error: "Subiectul poate avea maximum 200 caractere." };
  }
  if (value.preview_text.length > 300) {
    return { ok: false, error: "Preview text poate avea maximum 300 caractere." };
  }
  if (value.heading.length > 200) {
    return { ok: false, error: "Titlul poate avea maximum 200 caractere." };
  }
  if (value.body_text.length > 50_000) {
    return { ok: false, error: "Conținutul emailului este prea lung." };
  }
  if (value.footer_text.length > 2_000) {
    return { ok: false, error: "Footer-ul poate avea maximum 2.000 caractere." };
  }
  if (value.cta_text && !value.cta_url) {
    return { ok: false, error: "Completează și URL-ul butonului CTA." };
  }
  if (value.cta_url && !value.cta_text) {
    return { ok: false, error: "Completează și textul butonului CTA." };
  }
  if (!isSafePublicUrl(value.image_url)) {
    return { ok: false, error: "URL-ul imaginii trebuie să fie http(s)." };
  }
  if (!isSafePublicUrl(value.cta_url)) {
    return { ok: false, error: "URL-ul CTA trebuie să fie http(s)." };
  }

  return { ok: true, value };
}

export function parseRequiredEmail(
  value: unknown,
  label = "Email",
): { ok: true; value: string } | { ok: false; error: string } {
  const email = stringValue(value);
  if (!isValidEmail(email)) {
    return { ok: false, error: `${label} invalid.` };
  }
  return { ok: true, value: normalizeEmail(email) };
}

export function parseOptionalEmail(
  value: unknown,
  label = "Email",
): { ok: true; value: string | null } | { ok: false; error: string } {
  const email = stringValue(value);
  if (!email) return { ok: true, value: null };
  const parsed = parseRequiredEmail(email, label);
  return parsed.ok ? parsed : parsed;
}
