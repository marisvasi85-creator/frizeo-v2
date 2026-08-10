import { NextResponse } from "next/server";
import { assertEmailApiAccess } from "@/lib/frizeo-email/access";
import { duplicateMarketingSegment } from "@/lib/frizeo-email/segments";
import { UUID_PATTERN } from "@/lib/frizeo-email/validation";

type Params = Promise<{ id: string }>;

export async function POST(
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
    const segment = await duplicateMarketingSegment(id, auth.userId);
    if (!segment) {
      return NextResponse.json({ error: "Segment inexistent." }, { status: 404 });
    }
    return NextResponse.json({ segment }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nu am putut duplica segmentul.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
