import LifecycleClient from "./LifecycleClient";
import {
  getLifecycleFunnel,
  getLifecycleSettings,
  listLifecycleTenants,
} from "@/lib/frizeo-email/lifecycleAdmin";
import type { LifecycleSettings } from "@/lib/frizeo-email/lifecycle";

export default async function LifecyclePage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; outreach?: string }>;
}) {
  const params = await searchParams;
  const stage = params.stage || "all";
  const outreach = params.outreach || "all";

  const fallbackSettings: LifecycleSettings = {
    enabled: false,
    strategy_version: 2,
    strategy_started_at: null,
    min_hours_between_emails: 48,
    max_emails_per_day: 1,
    max_emails_30_days: 5,
    max_emails_first_7_days: 3,
    allow_existing_zero_booking_cohort: false,
    test_contact_ids: [] as string[],
    notes: "",
  };
  let settings = fallbackSettings;
  let tenants: Awaited<ReturnType<typeof listLifecycleTenants>> = [];
  let funnel: Record<string, number> = {};
  let error: string | null = null;

  try {
    settings = await getLifecycleSettings();
    [tenants, funnel] = await Promise.all([
      listLifecycleTenants({ stage, outreach }),
      getLifecycleFunnel(),
    ]);
  } catch (e) {
    error =
      e instanceof Error
        ? e.message
        : "Migrarea lifecycle v2 nu e aplicată încă pe acest mediu.";
    settings = fallbackSettings;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      )}
      <LifecycleClient
        settings={settings}
        tenants={tenants}
        funnel={funnel}
        stage={stage}
        outreach={outreach}
      />
    </div>
  );
}
