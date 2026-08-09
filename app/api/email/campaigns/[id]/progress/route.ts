import { NextResponse } from "next/server";
import { assertEmailApiAccess } from "@/lib/frizeo-email/access";
import {
  getCampaign,
  getCampaignProgress,
} from "@/lib/frizeo-email/campaigns";
import { UUID_PATTERN } from "@/lib/frizeo-email/validation";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

export async function GET(
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
    const [campaign, progress] = await Promise.all([
      getCampaign(id),
      getCampaignProgress(id),
    ]);
    if (!campaign) {
      return NextResponse.json(
        { error: "Campanie inexistentă." },
        { status: 404 },
      );
    }
    return NextResponse.json({ campaign, progress });
  } catch (error) {
    console.error("[email-campaign-progress] failed", {
      campaignId: id,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Nu am putut actualiza progresul campaniei." },
      { status: 500 },
    );
  }
}
