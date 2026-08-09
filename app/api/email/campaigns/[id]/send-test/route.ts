import { NextRequest, NextResponse } from "next/server";
import { assertEmailApiAccess } from "@/lib/frizeo-email/access";
import { getCampaign } from "@/lib/frizeo-email/campaigns";
import { getEmailAppUrlForRequest } from "@/lib/frizeo-email/config";
import {
  renderMarketingEmail,
  renderMarketingEmailText,
} from "@/lib/frizeo-email/renderEmail";
import { sendMarketingTest } from "@/lib/frizeo-email/provider";
import {
  parseRequiredEmail,
  UUID_PATTERN,
} from "@/lib/frizeo-email/validation";
import { enforceRateLimit } from "@/lib/security/rateLimit";

type Params = Promise<{ id: string }>;

export async function POST(
  request: NextRequest,
  { params }: { params: Params },
) {
  const auth = await assertEmailApiAccess();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Campanie invalidă." }, { status: 400 });
  }

  const limited = await enforceRateLimit(request, {
    bucket: "email-campaign-test",
    identifier: auth.userId,
    limit: 10,
    windowSeconds: 15 * 60,
  });
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalid." }, { status: 400 });
  }

  const recipient = parseRequiredEmail(body.email, "Emailul de test");
  if (!recipient.ok) {
    return NextResponse.json({ error: recipient.error }, { status: 400 });
  }

  try {
    const campaign = await getCampaign(id);
    if (!campaign) {
      return NextResponse.json({ error: "Campanie inexistentă." }, { status: 404 });
    }
    if (!campaign.subject.trim() || !campaign.body_text.trim()) {
      return NextResponse.json(
        { error: "Completează subiectul și conținutul înainte de test." },
        { status: 400 },
      );
    }
    const unsubscribeUrl = `${getEmailAppUrlForRequest(request.url).replace(/\/$/, "")}/unsubscribe/test-preview`;
    const renderInput = { ...campaign, unsubscribeUrl };
    const result = await sendMarketingTest({
      to: recipient.value,
      subject: campaign.subject,
      html: renderMarketingEmail(renderInput),
      text: renderMarketingEmailText(renderInput),
    });

    return NextResponse.json({
      success: true,
      provider: result.provider,
      message_id: result.messageId,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "marketing_provider_not_configured"
    ) {
      return NextResponse.json(
        {
          error:
            "Resend nu este configurat pentru acest environment. Verifică RESEND_API_KEY, MARKETING_EMAIL_FROM și MARKETING_EMAIL_REPLY_TO în Vercel.",
        },
        { status: 503 },
      );
    }

    console.error("[email-campaign-test] send failed", error);
    return NextResponse.json(
      { error: "Trimiterea testului a eșuat. Verifică providerul de marketing." },
      { status: 502 },
    );
  }
}
