import { NextRequest, NextResponse } from "next/server";
import {
  buildWebManifest,
  isAllowedPwaStartPath,
  type PwaManifestVariant,
} from "@/lib/pwa/manifestContent";

function parseVariant(value: string | null): PwaManifestVariant | null {
  if (value === "admin" || value === "booking") {
    return value;
  }

  return null;
}

export async function GET(req: NextRequest) {
  const start = req.nextUrl.searchParams.get("start")?.trim() ?? "";
  const variant = parseVariant(req.nextUrl.searchParams.get("variant"));
  const label = req.nextUrl.searchParams.get("label");

  if (!variant || !isAllowedPwaStartPath(start)) {
    return NextResponse.json({ error: "Invalid manifest request." }, { status: 400 });
  }

  const manifest = buildWebManifest({
    startUrl: start,
    variant,
    label,
  });

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
