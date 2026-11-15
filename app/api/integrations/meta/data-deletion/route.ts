import { deleteMetaUserData } from "@/lib/integrations/meta/reviewCallbacks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(request: Request) {
  return deleteMetaUserData(request);
}
