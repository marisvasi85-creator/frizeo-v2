import { startMetaConnect } from "@/lib/integrations/meta/handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 10;

export function POST(request: Request) {
  return startMetaConnect(request);
}
