import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getAutomation,
  listAutomationRuns,
} from "@/lib/frizeo-email/automations";
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

  return (
    <div className="space-y-4 max-w-6xl">
      <Link
        href="/email/automations"
        className="text-sm text-white/55 hover:text-white"
      >
        ← Automations
      </Link>
      <AutomationDetailClient
        automation={automation}
        initialRuns={runs}
        templateName={template?.name ?? null}
        templateKey={template?.template_key ?? null}
      />
    </div>
  );
}
