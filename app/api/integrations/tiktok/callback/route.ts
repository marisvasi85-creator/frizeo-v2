import { finishTikTokCallback } from "@/lib/integrations/tiktok/handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 15;

export function GET(request: Request) {
  return finishTikTokCallback(request);
}
