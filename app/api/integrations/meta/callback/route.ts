import { finishCallback } from "@/lib/integrations/meta/handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 10;

export function GET(request: Request) {
  return finishCallback(request);
}
