import { readKnownTikTokDraftStatus } from "@/lib/integrations/tiktok/statusHandlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 15;

export function POST(request: Request) {
  return readKnownTikTokDraftStatus(request);
}
