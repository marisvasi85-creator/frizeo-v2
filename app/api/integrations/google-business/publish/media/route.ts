import { uploadGooglePostImage } from "@/lib/integrations/google-business/handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 20;

export function POST(request: Request) {
  return uploadGooglePostImage(request);
}
