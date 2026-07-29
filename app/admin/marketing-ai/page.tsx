import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import { sessionActsAsBarber } from "../components/adminNav";
import { isMarketingAIConfigured, getMarketingAIStatus } from "@/lib/marketing-ai/generate";
import { listMarketingAIHistory } from "@/lib/marketing-ai/history";
import { getMarketingAIUsageStatus } from "@/lib/marketing-ai/usage";
import { supabaseAdmin } from "@/lib/supabase/admin";
import MarketingAIClient from "./MarketingAIClient";
import type { SocialLinks } from "@/lib/social/normalizeSocialUrl";
import AdminCard from "../components/AdminCard";
import AdminButton from "../components/AdminButton";

export default async function MarketingAIPage() {
  const session = await getAdminSession();
  if (!session?.barber) redirect("/login");

  const barber = session.barber;
  const role = session.role;
  const actsAsBarber = sessionActsAsBarber(session);
  const historyBarberId = role === "barber" ? barber.id : undefined;

  const [barbersRes, usage, initialHistory] = await Promise.all([
    supabaseAdmin
      .from("barbers")
      .select("id, display_name, instagram_url, facebook_url, tiktok_url")
      .eq("tenant_id", barber.tenant_id)
      .eq("active", true)
      .order("display_name"),
    getMarketingAIUsageStatus(barber.tenant_id),
    listMarketingAIHistory({
      tenantId: barber.tenant_id,
      barberId: historyBarberId,
      limit: 20,
    }),
  ]);

  const activeBarbers = barbersRes.data || [];
  const barberOptions = activeBarbers.map((item) => ({
    id: item.id,
    name: item.display_name || "Frizer",
  }));

  // Admin-only owner: default to first active barber, never the inactive self.
  const defaultBarberId =
    role === "barber" || actsAsBarber
      ? barber.id
      : (barberOptions[0]?.id ?? "");

  const defaultBarberRow =
    activeBarbers.find((b) => b.id === defaultBarberId) ?? null;

  const { data: servicesData } = defaultBarberId
    ? await supabaseAdmin
        .from("barber_services")
        .select("id, display_name, name, duration")
        .eq("barber_id", defaultBarberId)
        .eq("active", true)
        .order("sort_order", { ascending: true })
    : { data: [] as { id: string; display_name: string | null; name: string; duration: number }[] };

  const serviceOptions = (servicesData || []).map((service) => ({
    id: service.id,
    name: service.display_name || service.name,
    duration: service.duration,
  }));

  const aiStatus = getMarketingAIStatus();

  const socialSource = defaultBarberRow ?? barber;
  const initialSocialLinks: SocialLinks = {
    instagram: (socialSource.instagram_url as string | null | undefined) ?? null,
    facebook: (socialSource.facebook_url as string | null | undefined) ?? null,
    tiktok: (socialSource.tiktok_url as string | null | undefined) ?? null,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Marketing AI</h1>
        <p className="text-white/60 mt-1">
          Unealtă de salon — generează conținut pentru un frizer activ (text,
          Story/feed, WhatsApp și QR).
        </p>
      </div>

      {barberOptions.length === 0 ? (
        <AdminCard className="space-y-3">
          <p className="text-sm text-white/70">
            Nu există frizeri activi. Marketing AI are nevoie de cel puțin un
            frizer activ (tu sau un invitat) ca să genereze conținut.
          </p>
          {role === "owner" && (
            <AdminButton size="sm" href="/admin/barbers">
              Mergi la Frizeri
            </AdminButton>
          )}
        </AdminCard>
      ) : (
        <>
          {role === "owner" && !actsAsBarber && (
            <p className="text-sm text-white/50">
              Alege un frizer activ din listă. Linkurile sociale se iau din
              profilul frizerului.
            </p>
          )}
          <MarketingAIClient
            role={role}
            barbers={barberOptions}
            services={serviceOptions}
            defaultBarberId={defaultBarberId}
            configured={isMarketingAIConfigured()}
            provider={aiStatus.provider}
            model={aiStatus.model}
            modeLabel={aiStatus.modeLabel}
            isFreeTier={aiStatus.isFreeTier}
            diagnostics={aiStatus.diagnostics}
            usage={usage}
            initialSocialLinks={initialSocialLinks}
            initialHistory={initialHistory}
          />
        </>
      )}
    </div>
  );
}
