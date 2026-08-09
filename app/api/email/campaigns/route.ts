import { NextResponse } from "next/server";
import { assertEmailApiAccess } from "@/lib/frizeo-email/access";
import {
  createCampaign,
  listCampaigns,
} from "@/lib/frizeo-email/campaigns";
import { UUID_PATTERN } from "@/lib/frizeo-email/validation";

export async function GET() {
  const auth = await assertEmailApiAccess();
  if (!auth.ok) return auth.response;

  try {
    return NextResponse.json({ campaigns: await listCampaigns() });
  } catch (error) {
    console.error("[email-campaigns] list failed", error);
    return NextResponse.json(
      { error: "Nu am putut încărca campaniile." },
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
  if (!name || name.length > 160) {
    return NextResponse.json(
      { error: "Numele campaniei trebuie să aibă 1–160 caractere." },
      { status: 400 },
    );
  }

  const templateId =
    typeof body.template_id === "string" && body.template_id.trim()
      ? body.template_id.trim()
      : null;
  if (templateId && !UUID_PATTERN.test(templateId)) {
    return NextResponse.json({ error: "Template invalid." }, { status: 400 });
  }

  try {
    const campaign = await createCampaign(
      { name, templateId },
      auth.userId,
    );
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nu am putut crea campania.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
