import { NextResponse } from "next/server";
import {
  isMarketingCampaignEvent,
  isResendWebhookConfigured,
  processVerifiedResendWebhook,
  verifyResendWebhook,
} from "@/lib/frizeo-email/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_WEBHOOK_BYTES = 1_000_000;

export async function POST(request: Request) {
  if (!isResendWebhookConfigured()) {
    console.error("[resend-marketing-webhook] signing secret is not configured");
    return NextResponse.json(
      { error: "Webhook not configured." },
      { status: 503 },
    );
  }

  const id = request.headers.get("svix-id")?.trim() || "";
  const timestamp = request.headers.get("svix-timestamp")?.trim() || "";
  const signature = request.headers.get("svix-signature")?.trim() || "";
  if (!id || !timestamp || !signature) {
    return NextResponse.json(
      { error: "Missing webhook signature." },
      { status: 400 },
    );
  }

  const rawBody = await request.text();
  if (!rawBody || Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BYTES) {
    return NextResponse.json(
      { error: "Invalid webhook payload." },
      { status: 400 },
    );
  }

  let event;
  try {
    event = verifyResendWebhook({
      rawBody,
      headers: { id, timestamp, signature },
    });
  } catch {
    console.warn("[resend-marketing-webhook] invalid signature", {
      providerEventId: id.slice(0, 255),
    });
    return NextResponse.json(
      { error: "Invalid webhook signature." },
      { status: 400 },
    );
  }

  try {
    const result = await processVerifiedResendWebhook({
      providerEventId: id.slice(0, 255),
      event,
    });

    if (result.result === "unmatched") {
      console.warn("[resend-marketing-webhook] message not matched", {
        providerEventId: id.slice(0, 255),
        providerMessageId:
          "email_id" in event.data ? event.data.email_id : undefined,
        type: event.type,
      });

      // A tagged campaign event can race the worker's provider_message_id write.
      // Returning non-2xx asks Resend to retry; unrelated/test events are ignored.
      if (isMarketingCampaignEvent(event)) {
        return NextResponse.json(
          { error: "Campaign message not ready for matching." },
          { status: 503 },
        );
      }
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[resend-marketing-webhook] processing failed", {
      providerEventId: id.slice(0, 255),
      type: event.type,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 },
    );
  }
}
