import { NextResponse } from "next/server";
import { assertEmailApiAccess } from "@/lib/frizeo-email/access";
import {
  getCampaign,
  snapshotCampaignAudience,
} from "@/lib/frizeo-email/campaigns";
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
    const campaign = await getCampaign(id);
    if (!campaign) {
      return NextResponse.json({ error: "Campanie inexistentă." }, { status: 404 });
    }
    if (campaign.status !== "draft") {
      return NextResponse.json(
        { error: "Snapshot-ul poate fi refăcut doar pentru un draft." },
        { status: 409 },
      );
    }

    const recipientCount = await snapshotCampaignAudience(id);
    return NextResponse.json({ success: true, recipient_count: recipientCount });
  } catch (error) {
    console.error("[email-campaign-snapshot] failed", error);
    return NextResponse.json(
      { error: "Nu am putut genera snapshot-ul audienței." },
      { status: 500 },
    );
  }
}
