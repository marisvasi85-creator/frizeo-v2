import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  MarketingEmailContent,
  MarketingEmailTemplate,
} from "@/lib/frizeo-email/types";

export type SaveTemplateInput = MarketingEmailContent & {
  name: string;
};

export async function listEmailTemplates(): Promise<MarketingEmailTemplate[]> {
  const { data, error } = await supabaseAdmin
    .from("marketing_email_templates")
    .select("*")
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false });

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
): Promise<"deleted" | "not_found" | "default_protected"> {
  const template = await getEmailTemplate(id);
  if (!template) return "not_found";
  if (template.is_default) return "default_protected";

  const { error } = await supabaseAdmin
    .from("marketing_email_templates")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
  return "deleted";
}
