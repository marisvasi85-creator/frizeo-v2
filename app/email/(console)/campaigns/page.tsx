import CampaignsClient from "./CampaignsClient";
import { listCampaigns } from "@/lib/frizeo-email/campaigns";
import { listEmailTemplates } from "@/lib/frizeo-email/templates";
import { listMarketingSegments } from "@/lib/frizeo-email/segments";

export default async function CampaignsPage() {
  let campaigns: Awaited<ReturnType<typeof listCampaigns>> = [];
  let templates: Awaited<ReturnType<typeof listEmailTemplates>> = [];
  let segments: Awaited<ReturnType<typeof listMarketingSegments>> = [];
  let error: string | null = null;

  try {
    [campaigns, templates, segments] = await Promise.all([
      listCampaigns(),
      listEmailTemplates(),
      listMarketingSegments(),
    ]);
  } catch (loadError) {
    error =
      loadError instanceof Error
        ? loadError.message
        : "Nu am putut încărca Faza 2. Verifică migrarea Supabase.";
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      )}
      <CampaignsClient campaigns={campaigns} templates={templates} segments={segments} />
    </div>
  );
}
