import { NextResponse } from "next/server";
import { assertEmailApiAccess } from "@/lib/frizeo-email/access";
import {
  createEmailTemplate,
  listEmailTemplates,
} from "@/lib/frizeo-email/templates";
import { parseEmailContent } from "@/lib/frizeo-email/validation";

export async function GET() {
  const auth = await assertEmailApiAccess();
  if (!auth.ok) return auth.response;

  try {
    return NextResponse.json({ templates: await listEmailTemplates() });
  } catch (error) {
    console.error("[email-templates] list failed", error);
    return NextResponse.json(
      { error: "Nu am putut încărca template-urile." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await assertEmailApiAccess();
  if (!auth.ok) return auth.response;

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
    const template = await createEmailTemplate(
      { name, ...content.value },
      auth.userId,
    );
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nu am putut crea template-ul.";
    return NextResponse.json(
      { error: message },
      { status: message.includes("deja") ? 409 : 500 },
    );
  }
}
