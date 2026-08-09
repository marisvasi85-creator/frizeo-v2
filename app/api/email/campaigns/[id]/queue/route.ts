import { NextResponse } from "next/server";
import { assertEmailApiAccess } from "@/lib/frizeo-email/access";
import {
  getCampaign,
  getCampaignProgress,
  queueCampaign,
} from "@/lib/frizeo-email/campaigns";
import { getMarketingProviderStatus } from "@/lib/frizeo-email/provider";
import { UUID_PATTERN } from "@/lib/frizeo-email/validation";
import { isMarketingWorkerConfigured } from "@/lib/frizeo-email/workerAuth";
import { enforceRateLimit } from "@/lib/security/rateLimit";

type Params = Promise<{ id: string }>;

function queueError(message: string): { error: string; status: number } {
  if (message.includes("campaign_already_started")) {
    return { error: "Campania a fost deja pornită.", status: 409 };
  }
  if (message.includes("campaign_audience_empty")) {
    return { error: "Audiența nu conține destinatari eligibili.", status: 400 };
  }
  if (message.includes("campaign_content_incomplete")) {
    return {
      error: "Completează subiectul și conținutul înainte de trimitere.",
      status: 400,
    };
  }
  if (message.includes("controlled_test_audience_invalid")) {
    return {
      error: "Selectează între 1 și 5 contacte pentru testul controlat.",
      status: 400,
    };
  }
  if (message.includes("campaign_not_found")) {
    return { error: "Campanie inexistentă.", status: 404 };
  }
  return { error: "Nu am putut porni campania.", status: 500 };
}

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
    bucket: "email-campaign-queue",
    identifier: auth.userId,
    limit: 5,
    windowSeconds: 60 * 60,
  });
  if (limited) return limited;

  const provider = getMarketingProviderStatus();
  if (!provider.configured) {
    return NextResponse.json(
      { error: "Resend nu este configurat pentru acest environment." },
      { status: 503 },
    );
  }
  if (!isMarketingWorkerConfigured()) {
    return NextResponse.json(
      {
        error:
          "Workerul nu este configurat. Adaugă MARKETING_WORKER_SECRET în Vercel Preview și redeploy.",
      },
      { status: 503 },
    );
  }

  try {
    const campaign = await getCampaign(id);
    if (!campaign) {
      return NextResponse.json(
        { error: "Campanie inexistentă." },
        { status: 404 },
      );
    }
    if (!["draft", "scheduled"].includes(campaign.status)) {
      return NextResponse.json(
        { error: "Campania a fost deja pornită." },
        { status: 409 },
      );
    }

    const recipientCount = await queueCampaign(id);
    const [queuedCampaign, progress] = await Promise.all([
      getCampaign(id),
      getCampaignProgress(id),
    ]);

    return NextResponse.json({
      success: true,
      campaign: queuedCampaign,
      recipient_count: recipientCount,
      progress,
    });
  } catch (error) {
    const mapped = queueError(
      error instanceof Error ? error.message : "queue_failed",
    );
    if (mapped.status >= 500) {
      console.error("[email-campaign-queue] failed", {
        campaignId: id,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
