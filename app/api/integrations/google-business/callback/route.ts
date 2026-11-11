import { finishGoogleCallback } from "@/lib/integrations/google-business/handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 15;

export function GET(request: Request) {
  return finishGoogleCallback(request);
}
