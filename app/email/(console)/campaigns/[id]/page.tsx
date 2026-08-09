import { notFound } from "next/navigation";
import CampaignEditor from "./CampaignEditor";
import {
  getAudienceSummaries,
  getCampaign,
  getCampaignProgress,
  listEligibleTestContacts,
  listCampaignRecipients,
} from "@/lib/frizeo-email/campaigns";
import { listEmailTemplates } from "@/lib/frizeo-email/templates";
import { UUID_PATTERN } from "@/lib/frizeo-email/validation";

type Params = Promise<{ id: string }>;

export default async function CampaignPage({ params }: { params: Params }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const campaign = await getCampaign(id);
  if (!campaign) notFound();

  const [templates, audiences, testContacts, recipients, progress] =
    await Promise.all([
      listEmailTemplates(),
      getAudienceSummaries(),
      listEligibleTestContacts(),
      campaign.audience_snapshot_at
        ? listCampaignRecipients(id)
        : Promise.resolve([]),
      getCampaignProgress(id),
    ]);

  return (
    <CampaignEditor
      initialCampaign={campaign}
      templates={templates}
      audiences={audiences}
      testContacts={testContacts}
      initialRecipients={recipients}
      initialProgress={progress}
    />
  );
}
