import type {
  MarketingCtaUrlType,
  MarketingEmailContent,
} from "@/lib/frizeo-email/types";

export type MarketingVariableContext = {
  first_name?: string | null;
  app_url: string;
  dashboard_url?: string | null;
  booking_link?: string | null;
  trial_end_date?: string | null;
  plan_url?: string | null;
  feature_name?: string | null;
  feature_description?: string | null;
};

export function marketingCtaUrl(
  type: MarketingCtaUrlType,
  appUrl: string,
): string | null {
  const base = appUrl.replace(/\/$/, "");
  if (type === "register") return `${base}/signup`;
  if (type === "marketing") return base;
  if (type === "dashboard") return `${base}/admin/dashboard`;
  if (type === "plans") return `${base}/pricing`;
  if (type === "booking_link") return "{{booking_link}}";
  return null;
}

function cleanMissingVariables(value: string): string {
  return value
    .replace(/\{\{[a-z_]+\}\}/gi, "")
    .replace(/Salut\s*,\s*!/gi, "Salut!")
    .replace(/[ \t]+([,.!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function resolveValue(value: string, context: MarketingVariableContext): string {
  let resolved = value;

  if (!context.trial_end_date) {
    resolved = resolved
      .split(/\r?\n/)
      .filter((line) => !line.includes("{{trial_end_date}}"))
      .join("\n");
  }
  if (!context.feature_description) {
    resolved = resolved
      .split(/\r?\n/)
      .filter((line) => !line.includes("{{feature_description}}"))
      .join("\n");
  }
  if (!context.feature_name) {
    resolved = resolved
      .replace(": {{feature_name}}", "")
      .replace(
        "{{feature_name}} este acum disponibil.",
        "O funcție nouă este acum disponibilă.",
      )
      .replace(
        "Am adăugat {{feature_name}},",
        "Am adăugat o funcție nouă,",
      );
  }

  const variables: Record<string, string> = {
    first_name: context.first_name?.trim() || "",
    app_url: context.app_url,
    dashboard_url:
      context.dashboard_url || `${context.app_url.replace(/\/$/, "")}/admin/dashboard`,
    booking_link:
      context.booking_link ||
      context.dashboard_url ||
      `${context.app_url.replace(/\/$/, "")}/admin/dashboard`,
    trial_end_date: context.trial_end_date || "",
    plan_url:
      context.plan_url || `${context.app_url.replace(/\/$/, "")}/pricing`,
    feature_name: context.feature_name || "",
    feature_description: context.feature_description || "",
  };

  for (const [name, replacement] of Object.entries(variables)) {
    resolved = resolved.replaceAll(`{{${name}}}`, replacement);
  }
  return cleanMissingVariables(resolved);
}

export function resolveMarketingTemplateVariables(
  content: MarketingEmailContent,
  context: MarketingVariableContext,
): MarketingEmailContent {
  return {
    subject: resolveValue(content.subject, context),
    preview_text: resolveValue(content.preview_text, context),
    heading: resolveValue(content.heading, context),
    body_text: resolveValue(content.body_text, context),
    image_url: content.image_url
      ? resolveValue(content.image_url, context) || null
      : null,
    cta_text: content.cta_text
      ? resolveValue(content.cta_text, context) || null
      : null,
    cta_url: content.cta_url
      ? resolveValue(content.cta_url, context) || null
      : null,
    footer_text: resolveValue(content.footer_text, context),
  };
}
