import { listGoogleBusinessLocations } from "@/lib/integrations/google-business/handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 15;

export function POST(request: Request) {
  return listGoogleBusinessLocations(request);
}
