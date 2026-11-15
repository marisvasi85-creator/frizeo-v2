import { deauthorizeMeta } from "@/lib/integrations/meta/reviewCallbacks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(request: Request) {
  return deauthorizeMeta(request);
}
