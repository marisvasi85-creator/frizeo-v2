import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getAutomation,
  listAutomationRuns,
} from "@/lib/frizeo-email/automations";
import { getConversionStatsForAutomation } from "@/lib/frizeo-email/attribution";
import { getEmailTemplate } from "@/lib/frizeo-email/templates";
import AutomationDetailClient from "./AutomationDetailClient";

type Params = Promise<{ id: string }>;

export default async function AutomationDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const automation = await getAutomation(id);
  if (!automation) notFound();

  const [runs, template] = await Promise.all([
    listAutomationRuns({ automationId: id, status: "all", limit: 100 }),
    getEmailTemplate(automation.template_id),
  ]);

  const sentCount = runs.filter((run) => run.status === "sent" && !run.is_test)
    .length;
  const conversions = await getConversionStatsForAutomation(
    id,
    sentCount,
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
    <div className="space-y-4 max-w-6xl">
      <Link
        href="/email/automations"
        className="text-sm text-frz-ink/60 hover:text-frz-ink"
      >
        ← Automations
      </Link>
      <AutomationDetailClient
        automation={automation}
        initialRuns={runs}
        templateName={template?.name ?? null}
        templateKey={template?.template_key ?? null}
        conversions={conversions}
      />
    </div>
  );
}
