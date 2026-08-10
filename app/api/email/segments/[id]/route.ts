import { NextResponse } from "next/server";
import { assertEmailApiAccess } from "@/lib/frizeo-email/access";
import { parseMarketingSegmentInput } from "@/lib/frizeo-email/segmentDefinition";
import {
  deleteMarketingSegment,
  getMarketingSegment,
  listMarketingSegmentMembers,
  updateMarketingSegment,
} from "@/lib/frizeo-email/segments";
import { UUID_PATTERN } from "@/lib/frizeo-email/validation";

type Params = Promise<{ id: string }>;

export async function GET(
  request: Request,
  { params }: { params: Params },
) {
  const auth = await assertEmailApiAccess();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Segment invalid." }, { status: 400 });
  }
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") || 100);
  const offset = Number(url.searchParams.get("offset") || 0);
  try {
    const segment = await getMarketingSegment(id);
    if (!segment) {
      return NextResponse.json({ error: "Segment inexistent." }, { status: 404 });
    }
    const audience = await listMarketingSegmentMembers(id, { limit, offset });
    return NextResponse.json({ segment, ...audience });
  } catch (error) {
    console.error("[email-segment] get failed", error);
    return NextResponse.json(
      { error: "Nu am putut evalua segmentul." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Params },
) {
  const auth = await assertEmailApiAccess();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Segment invalid." }, { status: 400 });
  }
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
    const segment = await updateMarketingSegment(id, parsed.input);
    if (!segment) {
      return NextResponse.json(
        { error: "Segment inexistent sau protejat." },
        { status: 409 },
      );
    }
    return NextResponse.json({ segment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nu am putut salva segmentul.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Params },
) {
  const auth = await assertEmailApiAccess();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Segment invalid." }, { status: 400 });
  }
  try {
    const result = await deleteMarketingSegment(id, auth.userId);
    if (result === "not_found") {
      return NextResponse.json({ error: "Segment inexistent." }, { status: 404 });
    }
    if (result === "protected") {
      return NextResponse.json(
        { error: "Segmentele Frizeo System nu pot fi șterse." },
        { status: 409 },
      );
    }
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[email-segment] delete failed", error);
    return NextResponse.json(
      { error: "Nu am putut șterge segmentul." },
      { status: 500 },
    );
  }
}
