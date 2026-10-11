import { verifyPublish } from "@/lib/integrations/meta/publish/handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 10;

export function POST(request: Request) {
  return verifyPublish(request);
}
