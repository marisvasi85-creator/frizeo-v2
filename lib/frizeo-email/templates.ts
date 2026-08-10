import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  MarketingEmailContent,
  MarketingEmailTemplate,
} from "@/lib/frizeo-email/types";
import { getFrizeoAppUrl } from "@/lib/frizeo-email/config";
import { marketingCtaUrl } from "@/lib/frizeo-email/templateVariables";

export type SaveTemplateInput = MarketingEmailContent & {
  name: string;
};

export async function listEmailTemplates(): Promise<MarketingEmailTemplate[]> {
  const { data, error } = await supabaseAdmin
    .from("marketing_email_templates")
    .select("*")
    .order("is_system_template", { ascending: false })
    .order("category", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as MarketingEmailTemplate[];
}

export async function getEmailTemplate(
  id: string,
): Promise<MarketingEmailTemplate | null> {
  const { data, error } = await supabaseAdmin
    .from("marketing_email_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as MarketingEmailTemplate | null) ?? null;
}

export async function createEmailTemplate(
  input: SaveTemplateInput,
  createdBy: string,
): Promise<MarketingEmailTemplate> {
  const { data, error } = await supabaseAdmin
    .from("marketing_email_templates")
    .insert({
      ...input,
      template_key: null,
      category: "custom",
      recommended_audience: null,
      automation_key: null,
      cta_url_type: "custom",
      is_system_template: false,
      is_default: false,
      created_by: createdBy,
    })
    .select("*")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      throw new Error("Există deja un template cu acest nume.");
    }
    throw new Error(error?.message || "Nu am putut crea template-ul.");
  }

  return data as MarketingEmailTemplate;
}

export async function updateEmailTemplate(
  id: string,
  input: SaveTemplateInput,
): Promise<MarketingEmailTemplate | null> {
  const { data, error } = await supabaseAdmin
    .from("marketing_email_templates")
    .update(input)
    .eq("id", id)
    .eq("is_system_template", false)
    .select("*")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Există deja un template cu acest nume.");
    }
    throw new Error(error.message);
  }

  return (data as MarketingEmailTemplate | null) ?? null;
}

export async function deleteEmailTemplate(
  id: string,
): Promise<"deleted" | "not_found" | "protected"> {
  const template = await getEmailTemplate(id);
  if (!template) return "not_found";
  if (template.is_default || template.is_system_template) return "protected";

  const { error } = await supabaseAdmin
    .from("marketing_email_templates")
    .delete()
    .eq("id", id)
    .eq("is_system_template", false);

  if (error) throw new Error(error.message);
  return "deleted";
}

export async function duplicateEmailTemplate(
  id: string,
  createdBy: string,
): Promise<MarketingEmailTemplate | null> {
  const source = await getEmailTemplate(id);
  if (!source) return null;

  let name = `${source.name} — copie`;
  for (let suffix = 2; suffix <= 20; suffix += 1) {
    const { data, error } = await supabaseAdmin
      .from("marketing_email_templates")
      .insert({
        name,
        subject: source.subject,
        preview_text: source.preview_text,
        heading: source.heading,
        body_text: source.body_text,
        image_url: source.image_url,
        cta_text: source.cta_text,
        cta_url:
          marketingCtaUrl(source.cta_url_type, getFrizeoAppUrl()) ??
          source.cta_url,
        footer_text: source.footer_text,
        template_key: null,
        category: "custom",
        recommended_audience: source.recommended_audience,
        automation_key: null,
        cta_url_type: "custom",
        is_system_template: false,
        is_default: false,
        created_by: createdBy,
      })
      .select("*")
      .single();

    if (!error && data) return data as MarketingEmailTemplate;
    if (error?.code !== "23505") {
      throw new Error(error?.message || "Nu am putut duplica template-ul.");
    }
    name = `${source.name} — copie ${suffix}`;
  }
  throw new Error("Există prea multe copii cu același nume.");
}
