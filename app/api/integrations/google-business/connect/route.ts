import { startGoogleConnect } from "@/lib/integrations/google-business/handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 10;

export function POST(request: Request) {
  return startGoogleConnect(request);
}
