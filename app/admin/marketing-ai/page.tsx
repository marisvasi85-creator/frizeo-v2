import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import { isMarketingAIConfigured, getMarketingAIStatus } from "@/lib/marketing-ai/generate";
import { getMarketingAIUsageStatus } from "@/lib/marketing-ai/usage";
import { supabaseAdmin } from "@/lib/supabase/admin";
import MarketingAIClient from "./MarketingAIClient";
import type { SocialLinks } from "@/lib/social/normalizeSocialUrl";

export default async function MarketingAIPage() {
  const session = await getAdminSession();
  if (!session?.barber) redirect("/login");

  const barber = session.barber;
  const role = session.role;

  const [barbersRes, servicesRes, usage] = await Promise.all([
    supabaseAdmin
      .from("barbers")
      .select("id, display_name")
      .eq("tenant_id", barber.tenant_id)
      .eq("active", true)
      .order("display_name"),
    supabaseAdmin
      .from("barber_services")
      .select("id, display_name, name, duration")
      .eq("barber_id", barber.id)
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    getMarketingAIUsageStatus(barber.tenant_id),
  ]);

  const barberOptions = (barbersRes.data || []).map((item) => ({
    id: item.id,
    name: item.display_name || "Frizer",
  }));

  const serviceOptions = (servicesRes.data || []).map((service) => ({
    id: service.id,
    name: service.display_name || service.name,
    duration: service.duration,
  }));

  const aiStatus = getMarketingAIStatus();

  const initialSocialLinks: SocialLinks = {
    instagram: (barber.instagram_url as string | null | undefined) ?? null,
    facebook: (barber.facebook_url as string | null | undefined) ?? null,
    tiktok: (barber.tiktok_url as string | null | undefined) ?? null,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Marketing AI</h1>
        <p className="text-white/60 mt-1">
          Generează postări, reel-uri și promoții în câteva secunde — fără să
          stai să scrii.
        </p>
      </div>

      <MarketingAIClient
        role={role}
        barbers={barberOptions}
        services={serviceOptions}
        defaultBarberId={barber.id}
        configured={isMarketingAIConfigured()}
        provider={aiStatus.provider}
        model={aiStatus.model}
        modeLabel={aiStatus.modeLabel}
        isFreeTier={aiStatus.isFreeTier}
        diagnostics={aiStatus.diagnostics}
        usage={usage}
        initialSocialLinks={initialSocialLinks}
      />
    </div>
  );
}
