import { NextResponse } from "next/server";
import { hostnameFromRequest, isProduction, isStagingHostname } from "@/lib/app/environment";
import { serveTikTokDraftImage } from "@/lib/integrations/tiktok/mediaGrant";
import { readTikTokMediaGrant } from "@/lib/integrations/tiktok/store";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 15;

async function readPrivateJpeg(objectPath: string): Promise<Buffer | null> {
  const { data, error } = await supabaseAdmin.storage.from("marketing-publish").download(objectPath);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const served = await serveTikTokDraftImage({
    tokenParam: token,
    production: isProduction(),
    stagingHost: isStagingHostname(hostnameFromRequest(request)),
    now: new Date(),
    readGrant: readTikTokMediaGrant,
    readObject: readPrivateJpeg,
  });
  if (served.status === 404) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(served.body), {
    status: 200,
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
