import { NextResponse } from "next/server";
import { assertEmailApiAccess } from "@/lib/frizeo-email/access";
import {
  deleteEmailTemplate,
  getEmailTemplate,
  updateEmailTemplate,
} from "@/lib/frizeo-email/templates";
import {
  parseEmailContent,
  UUID_PATTERN,
} from "@/lib/frizeo-email/validation";

type Params = Promise<{ id: string }>;

export async function GET(
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
    const template = await getEmailTemplate(id);
    if (!template) {
      return NextResponse.json({ error: "Template inexistent." }, { status: 404 });
    }
    return NextResponse.json({ template });
  } catch (error) {
    console.error("[email-template] get failed", error);
    return NextResponse.json(
      { error: "Nu am putut încărca template-ul." },
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
    return NextResponse.json({ error: "Template invalid." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalid." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 120) {
    return NextResponse.json(
      { error: "Numele template-ului trebuie să aibă 1–120 caractere." },
      { status: 400 },
    );
  }
  const content = parseEmailContent(body);
  if (!content.ok) {
    return NextResponse.json({ error: content.error }, { status: 400 });
  }

  try {
    const template = await updateEmailTemplate(id, {
      name,
      ...content.value,
    });
    if (!template) {
      return NextResponse.json({ error: "Template inexistent." }, { status: 404 });
    }
    return NextResponse.json({ template });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Nu am putut actualiza template-ul.";
    return NextResponse.json(
      { error: message },
      { status: message.includes("deja") ? 409 : 500 },
    );
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
    return NextResponse.json({ error: "Template invalid." }, { status: 400 });
  }

  try {
    const result = await deleteEmailTemplate(id);
    if (result === "not_found") {
      return NextResponse.json({ error: "Template inexistent." }, { status: 404 });
    }
    if (result === "default_protected") {
      return NextResponse.json(
        { error: "Template-ul implicit Frizeo nu poate fi șters." },
        { status: 409 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[email-template] delete failed", error);
    return NextResponse.json(
      { error: "Nu am putut șterge template-ul." },
      { status: 500 },
    );
  }
}
