import { NextResponse } from "next/server";

export type WebhookReceiptPlan =
  | { action: "duplicate"; externalEventId: string }
  | { action: "record"; externalEventId: string; status: "received" };

/**
 * Providers are not implemented. The route stays deny-by-default and does
 * not claim that a signature was checked.
 */
export function webhookFoundationResponse(): NextResponse {
  return NextResponse.json(
    { error: "not_configured" },
    { status: 404, headers: { "cache-control": "no-store" } },
  );
}

export function planWebhookReceipt(input: {
  existingExternalIds: readonly string[];
  externalEventId: string;
}): WebhookReceiptPlan {
  if (input.existingExternalIds.includes(input.externalEventId)) {
    return { action: "duplicate", externalEventId: input.externalEventId };
  }
  return {
    action: "record",
    externalEventId: input.externalEventId,
    status: "received",
  };
}
