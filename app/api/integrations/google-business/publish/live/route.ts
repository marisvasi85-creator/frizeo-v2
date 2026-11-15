import { publishGoogleLive, readPublishedGooglePost } from "@/lib/integrations/google-business/handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export function GET(request: Request) {
  return readPublishedGooglePost(request);
}

export function POST(request: Request) {
  return publishGoogleLive(request);
}
