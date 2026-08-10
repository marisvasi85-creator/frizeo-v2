import { NextResponse } from "next/server";
import { assertEmailApiAccess } from "@/lib/frizeo-email/access";
import { getAutomation } from "@/lib/frizeo-email/automations";
import { getEmailTemplate } from "@/lib/frizeo-email/templates";
import { sendMarketingTest } from "@/lib/frizeo-email/provider";
import {
  marketingCtaUrl,
  resolveMarketingTemplateVariables,
} from "@/lib/frizeo-email/templateVariables";
import {
  renderMarketingEmail,
  renderMarketingEmailText,
} from "@/lib/frizeo-email/renderEmail";
import { getEmailAppUrlForRequest, getFrizeoAppUrl } from "@/lib/frizeo-email/config";
import { ensureUnsubscribeToken, buildUnsubscribeUrl } from "@/lib/frizeo-email/unsubscribe";
import { isValidEmail, normalizeEmail } from "@/lib/auth/credentials";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { MarketingCtaUrlType } from "@/lib/frizeo-email/types";

type Params = Promise<{ id: string }>;

/**
 * Sends the automation template via Resend as a one-off test.
 * Does not create a lifecycle trigger run / does not mutate trial state.
 */
export async function POST(
  request: Request,
  context: { params: Params },
) {
  const auth = await assertEmailApiAccess();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  let body: { email?: string; contact_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalid." }, { status: 400 });
  }

  try {
    const automation = await getAutomation(id);
    if (!automation) {
      return NextResponse.json({ error: "Automation not found." }, { status: 404 });
    }

    const template = await getEmailTemplate(automation.template_id);
    if (!template) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }

    let to = body.email ? normalizeEmail(body.email) : "";
    let firstName: string | null = "Test";
    let contactId: string | null = body.contact_id || null;

    if (contactId) {
      const { data: contact } = await supabaseAdmin
        .from("marketing_contacts")
        .select("id, email, first_name")
        .eq("id", contactId)
        .is("deleted_at", null)
        .maybeSingle();
      if (!contact) {
        return NextResponse.json({ error: "Contact not found." }, { status: 404 });
      }
      to = normalizeEmail(contact.email);
      firstName = contact.first_name;
      contactId = contact.id;
    } else if (isValidEmail(to)) {
      const { data: existing } = await supabaseAdmin
        .from("marketing_contacts")
        .select("id, email, first_name")
        .eq("email_normalized", to)
        .is("deleted_at", null)
        .maybeSingle();
      if (existing) {
        contactId = existing.id;
        firstName = existing.first_name;
      } else {
        const { data: created, error: createError } = await supabaseAdmin
          .from("marketing_contacts")
          .insert({
            email: to,
            first_name: "Test",
            source: "manual",
            status: "subscribed",
            marketing_consent: true,
            consent_source: "automation_send_test",
            consent_at: new Date().toISOString(),
          })
          .select("id, first_name")
          .single();
        if (createError || !created) {
          return NextResponse.json(
            { error: createError?.message || "Nu am putut crea contactul de test." },
            { status: 500 },
          );
        }
        contactId = created.id;
        firstName = created.first_name;
      }
    }

    if (!contactId || !isValidEmail(to)) {
      return NextResponse.json(
        { error: "Email sau contact_id este obligatoriu." },
        { status: 400 },
      );
    }

    const appUrl = getFrizeoAppUrl();
    const emailAppUrl = getEmailAppUrlForRequest(request.url);
    const ctaType = template.cta_url_type as MarketingCtaUrlType;
    const content = {
      subject: template.subject,
      preview_text: template.preview_text,
      heading: template.heading,
      body_text: template.body_text,
      image_url: template.image_url,
      cta_text: template.cta_text,
      cta_url:
        ctaType === "custom"
          ? template.cta_url
          : marketingCtaUrl(ctaType, appUrl) || template.cta_url,
      footer_text: template.footer_text,
    };

    const resolved = resolveMarketingTemplateVariables(content, {
      first_name: firstName,
      app_url: appUrl,
      trial_end_date: null,
    });

    const token = await ensureUnsubscribeToken(contactId);
    const unsubscribeUrl = buildUnsubscribeUrl(token, emailAppUrl);

    const renderInput = { ...resolved, unsubscribeUrl };
    const result = await sendMarketingTest({
      to,
      subject: `[TEST] ${resolved.subject}`,
      html: renderMarketingEmail(renderInput),
      text: renderMarketingEmailText(renderInput),
    });

    // Audit-only test row (does not use lifecycle trigger_reference uniqueness).
    await supabaseAdmin.from("marketing_automation_runs").insert({
      automation_id: automation.id,
      contact_id: contactId,
      trigger_key: "manual_test",
      trigger_reference: `test:${automation.id}:${Date.now()}:${to}`,
      status: "sent",
      scheduled_for: new Date().toISOString(),
      sent_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      provider: result.provider,
      provider_message_id: result.messageId,
      is_test: true,
      attempt_count: 1,
    });

    return NextResponse.json({
      success: true,
      provider: result.provider,
      messageId: result.messageId,
      to,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Send test automation eșuat.",
      },
      { status: 500 },
    );
  }
}
