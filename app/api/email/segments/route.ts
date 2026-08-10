import { NextResponse } from "next/server";
import { assertEmailApiAccess } from "@/lib/frizeo-email/access";
import { parseMarketingSegmentInput } from "@/lib/frizeo-email/segmentDefinition";
import {
  createMarketingSegment,
  listMarketingSegments,
} from "@/lib/frizeo-email/segments";

export async function GET() {
  const auth = await assertEmailApiAccess();
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ segments: await listMarketingSegments() });
  } catch (error) {
    console.error("[email-segments] list failed", error);
    return NextResponse.json(
      { error: "Nu am putut încărca segmentele." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await assertEmailApiAccess();
  if (!auth.ok) return auth.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalid." }, { status: 400 });
  }
  const parsed = parseMarketingSegmentInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  try {
    const segment = await createMarketingSegment(parsed.input, auth.userId);
    return NextResponse.json({ segment }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nu am putut crea segmentul.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
