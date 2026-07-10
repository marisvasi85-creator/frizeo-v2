import { redirect } from "next/navigation";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { getCurrentRole } from "@/lib/auth/getCurrentRole";
import { isMarketingAIConfigured, getMarketingAIStatus } from "@/lib/marketing-ai/generate";
import { supabaseAdmin } from "@/lib/supabase/admin";
import MarketingAIClient from "./MarketingAIClient";

export default async function MarketingAIPage() {
  const barber = await getCurrentBarberInTenant();
  if (!barber) redirect("/login");

  const role = await getCurrentRole();

  const { data: barbers } = await supabaseAdmin
    .from("barbers")
    .select("id, display_name")
    .eq("tenant_id", barber.tenant_id)
    .eq("active", true)
    .order("display_name");

  const { data: services } = await supabaseAdmin
    .from("barber_services")
    .select("id, display_name, name, duration")
    .eq("barber_id", barber.id)
    .eq("active", true)
    .order("sort_order", { ascending: true });

  const barberOptions = (barbers || []).map((item) => ({
    id: item.id,
    name: item.display_name || "Frizer",
  }));

  const serviceOptions = (services || []).map((service) => ({
    id: service.id,
    name: service.display_name || service.name,
    duration: service.duration,
  }));

  const aiStatus = getMarketingAIStatus();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Marketing AI</h1>
        <p className="text-white/60 mt-1">
          Generează postări, reel-uri și promoții în câteva secunde — fără să stai să scrii.
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
      />
    </div>
  );
}
