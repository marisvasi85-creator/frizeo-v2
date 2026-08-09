import { NextResponse } from "next/server";
import { assertEmailApiAccess } from "@/lib/frizeo-email/access";
import {
  getCampaign,
  listCampaignRecipients,
} from "@/lib/frizeo-email/campaigns";
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
    return NextResponse.json({ error: "Campanie invalidă." }, { status: 400 });
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") || 500);

  try {
    const campaign = await getCampaign(id);
    if (!campaign) {
      return NextResponse.json({ error: "Campanie inexistentă." }, { status: 404 });
    }
    const recipients = await listCampaignRecipients(id, limit);
    return NextResponse.json({ recipients, total: campaign.recipient_count });
  } catch (error) {
    console.error("[email-campaign-recipients] list failed", error);
    return NextResponse.json(
      { error: "Nu am putut încărca recipientele." },
      { status: 500 },
    );
  }
}
