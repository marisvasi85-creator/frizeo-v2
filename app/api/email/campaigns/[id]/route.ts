import { NextResponse } from "next/server";
import { assertEmailApiAccess } from "@/lib/frizeo-email/access";
import {
  deleteCampaign,
  getCampaign,
  updateCampaign,
} from "@/lib/frizeo-email/campaigns";
import {
  MARKETING_AUDIENCE_KINDS,
  type MarketingAudienceKind,
} from "@/lib/frizeo-email/types";
import {
  parseEmailContent,
  parseOptionalEmail,
  UUID_PATTERN,
} from "@/lib/frizeo-email/validation";

type Params = Promise<{ id: string }>;

export async function GET(
  _request: Request,
  { params }: { params: Params },
) {
  const auth = await assertEmailApiAccess();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Campanie invalidă." }, { status: 400 });
  }

  try {
    const campaign = await getCampaign(id);
    if (!campaign) {
      return NextResponse.json({ error: "Campanie inexistentă." }, { status: 404 });
    }
    return NextResponse.json({ campaign });
  } catch (error) {
    console.error("[email-campaign] get failed", error);
    return NextResponse.json(
      { error: "Nu am putut încărca această campanie." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Params },
) {
  const auth = await assertEmailApiAccess();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Campanie invalidă." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalid." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const senderName =
    typeof body.sender_name === "string" ? body.sender_name.trim() : "";
  if (!name || name.length > 160) {
    return NextResponse.json(
      { error: "Numele campaniei trebuie să aibă 1–160 caractere." },
      { status: 400 },
    );
  }
  if (!senderName || senderName.length > 120) {
    return NextResponse.json(
      { error: "Sender name trebuie să aibă 1–120 caractere." },
      { status: 400 },
    );
  }

  const senderEmail = parseOptionalEmail(body.sender_email, "Sender email");
  if (!senderEmail.ok) {
    return NextResponse.json({ error: senderEmail.error }, { status: 400 });
  }
  const replyTo = parseOptionalEmail(body.reply_to, "Reply-To");
  if (!replyTo.ok) {
    return NextResponse.json({ error: replyTo.error }, { status: 400 });
  }
  const content = parseEmailContent(body);
  if (!content.ok) {
    return NextResponse.json({ error: content.error }, { status: 400 });
  }

  const audienceRaw = String(body.audience_kind || "all_subscribed");
  if (
    !MARKETING_AUDIENCE_KINDS.includes(
      audienceRaw as MarketingAudienceKind,
    )
  ) {
    return NextResponse.json({ error: "Audiență invalidă." }, { status: 400 });
  }

  const testContactIds = Array.isArray(body.test_contact_ids)
    ? [...new Set(body.test_contact_ids)]
    : [];
  if (
    testContactIds.length > 5 ||
    testContactIds.some(
      (value) => typeof value !== "string" || !UUID_PATTERN.test(value),
    )
  ) {
    return NextResponse.json(
      { error: "Audiența de test acceptă maximum 5 contacte valide." },
      { status: 400 },
    );
  }

  const templateId =
    typeof body.template_id === "string" && body.template_id.trim()
      ? body.template_id.trim()
      : null;
  if (templateId && !UUID_PATTERN.test(templateId)) {
    return NextResponse.json({ error: "Template invalid." }, { status: 400 });
  }

  try {
    const campaign = await updateCampaign(id, {
      name,
      sender_name: senderName,
      sender_email: senderEmail.value || "",
      reply_to: replyTo.value,
      template_id: templateId,
      audience_kind: audienceRaw as MarketingAudienceKind,
      test_contact_ids: testContactIds as string[],
      ...content.value,
    });
    if (!campaign) {
      return NextResponse.json({ error: "Campanie inexistentă." }, { status: 404 });
    }
    return NextResponse.json({ campaign });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Nu am putut salva campania.";
    return NextResponse.json(
      { error: message },
      { status: message.includes("draft") ? 409 : 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Params },
) {
  const auth = await assertEmailApiAccess();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Campanie invalidă." }, { status: 400 });
  }

  try {
    const result = await deleteCampaign(id, auth.userId);
    if (result === "not_found") {
      return NextResponse.json({ error: "Campanie inexistentă." }, { status: 404 });
    }
    if (result === "active_protected") {
      return NextResponse.json(
        { error: "Campania este activă. Anuleaz-o înainte de a o arhiva." },
        { status: 409 },
      );
    }
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[email-campaign] delete failed", error);
    return NextResponse.json(
      { error: "Nu am putut șterge campania." },
      { status: 500 },
    );
  }
}
