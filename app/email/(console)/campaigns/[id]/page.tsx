import { notFound } from "next/navigation";
import CampaignEditor from "./CampaignEditor";
import {
  getAudienceSummaries,
  getCampaign,
  getCampaignProgress,
  listEligibleTestContacts,
  listCampaignRecipients,
} from "@/lib/frizeo-email/campaigns";
import { getConversionStatsForCampaign } from "@/lib/frizeo-email/attribution";
import { listEmailTemplates } from "@/lib/frizeo-email/templates";
import { listMarketingSegments } from "@/lib/frizeo-email/segments";
import { UUID_PATTERN } from "@/lib/frizeo-email/validation";

type Params = Promise<{ id: string }>;

export default async function CampaignPage({ params }: { params: Params }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const campaign = await getCampaign(id);
  if (!campaign) notFound();

  const [templates, audiences, segments, testContacts, recipients, progress] =
    await Promise.all([
      listEmailTemplates(),
      getAudienceSummaries(),
      listMarketingSegments(),
      listEligibleTestContacts(),
      campaign.audience_snapshot_at
        ? listCampaignRecipients(id)
        : Promise.resolve([]),
      getCampaignProgress(id),
    ]);

  const conversions = await getConversionStatsForCampaign(
    id,
    progress.sent || Number(campaign.sent_count || 0),
  ).catch(() => ({
    signups: 0,
    trials: 0,
    paid: 0,
    signup_rate: null as number | null,
    trial_rate: null as number | null,
    paid_rate: null as number | null,
    attributed_mrr: 0,
    currency: "RON",
  }));

  return (
    <CampaignEditor
      initialCampaign={campaign}
      templates={templates}
      audiences={audiences}
      segments={segments}
      testContacts={testContacts}
      initialRecipients={recipients}
      initialProgress={progress}
      initialConversions={conversions}
    />
  );
}
