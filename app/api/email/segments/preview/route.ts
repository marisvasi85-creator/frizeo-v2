import { NextResponse } from "next/server";
import { assertEmailApiAccess } from "@/lib/frizeo-email/access";
import { parseMarketingSegmentDefinition } from "@/lib/frizeo-email/segmentDefinition";
import { previewMarketingSegment } from "@/lib/frizeo-email/segments";

export async function POST(request: Request) {
  const auth = await assertEmailApiAccess();
  if (!auth.ok) return auth.response;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalid." }, { status: 400 });
  }
  const parsed = parseMarketingSegmentDefinition(body.definition);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  try {
    const preview = await previewMarketingSegment(parsed.definition, 10);
    return NextResponse.json(preview);
  } catch (error) {
    console.error("[email-segment-preview] failed", error);
    return NextResponse.json(
      { error: "Nu am putut calcula preview-ul." },
      { status: 500 },
    );
  }
}
