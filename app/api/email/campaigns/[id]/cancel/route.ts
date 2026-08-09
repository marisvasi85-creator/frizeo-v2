import { NextResponse } from "next/server";
import { assertEmailApiAccess } from "@/lib/frizeo-email/access";
import {
  cancelCampaign,
  getCampaign,
  getCampaignProgress,
} from "@/lib/frizeo-email/campaigns";
import { UUID_PATTERN } from "@/lib/frizeo-email/validation";
import { enforceRateLimit } from "@/lib/security/rateLimit";

type Params = Promise<{ id: string }>;

export async function POST(
  request: Request,
  { params }: { params: Params },
) {
  const auth = await assertEmailApiAccess();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Campanie invalidă." }, { status: 400 });
  }

  const limited = await enforceRateLimit(request, {
    bucket: "email-campaign-cancel",
    identifier: auth.userId,
    limit: 10,
    windowSeconds: 15 * 60,
  });
  if (limited) return limited;

  try {
    const cancelled = await cancelCampaign(id);
    if (!cancelled) {
      return NextResponse.json(
        { error: "Campania nu mai poate fi anulată." },
        { status: 409 },
      );
    }
    const [campaign, progress] = await Promise.all([
      getCampaign(id),
      getCampaignProgress(id),
    ]);
    return NextResponse.json({ success: true, campaign, progress });
  } catch (error) {
    const message = error instanceof Error ? error.message : "cancel_failed";
    if (message.includes("campaign_not_found")) {
      return NextResponse.json(
        { error: "Campanie inexistentă." },
        { status: 404 },
      );
    }
    console.error("[email-campaign-cancel] failed", {
      campaignId: id,
      message,
    });
    return NextResponse.json(
      { error: "Nu am putut anula campania." },
      { status: 500 },
    );
  }
}
