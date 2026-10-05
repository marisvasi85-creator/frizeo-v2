import { webhookFoundationResponse } from "@/lib/integrations/webhooks/foundation";

export const dynamic = "force-dynamic";

export function GET() {
  return webhookFoundationResponse();
}

export function POST() {
  return webhookFoundationResponse();
}