import { NextResponse } from "next/server";
import { assertEmailApiAccess } from "@/lib/frizeo-email/access";
import { duplicateEmailTemplate } from "@/lib/frizeo-email/templates";
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
    return NextResponse.json({ error: "Template invalid." }, { status: 400 });
  }

  try {
    const template = await duplicateEmailTemplate(id, auth.userId);
    if (!template) {
      return NextResponse.json({ error: "Template inexistent." }, { status: 404 });
    }
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error("[email-template] duplicate failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nu am putut duplica template-ul." },
      { status: 500 },
    );
  }
}
