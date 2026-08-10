import { NextResponse } from "next/server";
import { assertEmailApiAccess } from "@/lib/frizeo-email/access";
import { duplicateCampaign } from "@/lib/frizeo-email/campaigns";
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
    return NextResponse.json({ error: "Campanie invalidă." }, { status: 400 });
  }
  try {
    const campaign = await duplicateCampaign(id, auth.userId);
    if (!campaign) {
      return NextResponse.json({ error: "Campanie inexistentă." }, { status: 404 });
    }
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    console.error("[email-campaign] duplicate failed", error);
    return NextResponse.json(
      { error: "Nu am putut duplica campania." },
      { status: 500 },
    );
  }
}
