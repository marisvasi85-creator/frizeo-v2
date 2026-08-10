import AutomationsClient from "./AutomationsClient";
import { listAutomationsWithStats } from "@/lib/frizeo-email/automations";

export default async function AutomationsPage() {
  let automations: Awaited<ReturnType<typeof listAutomationsWithStats>> = [];
  let error: string | null = null;

  try {
    automations = await listAutomationsWithStats();
  } catch (e) {
    error =
      e instanceof Error
        ? e.message
        : "Nu am putut încărca automations. Verifică migrarea Phase 6.";
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      )}
      <AutomationsClient initialAutomations={automations} />
    </div>
  );
}
