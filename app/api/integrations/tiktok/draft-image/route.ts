import { storeTikTokDraftImage } from "@/lib/integrations/tiktok/draftHandlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 20;

export function POST(request: Request) {
  return storeTikTokDraftImage(request);
}
