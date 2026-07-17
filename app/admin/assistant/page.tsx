import { redirect } from "next/navigation";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import {
  isAssistantLlmConfigured,
  isFrizeoAssistantEnabled,
} from "@/lib/assistant/config";
import AssistantClient from "./AssistantClient";

export default async function AssistantPage() {
  if (!isFrizeoAssistantEnabled()) {
    redirect("/admin/dashboard");
  }

  const barber = await getCurrentBarberInTenant();
  if (!barber) redirect("/login");

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <div className="inline-flex items-center gap-2 text-xs text-emerald-300/90 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full mb-3">
          Staging · faza 1 (read-only)
        </div>
        <h1 className="text-2xl font-semibold">Frizeo Assistant</h1>
        <p className="text-white/60 mt-1">
          Întreabă despre programări, servicii, popularitate și abonament. Fără
          încasări. Prețul serviciilor apare doar dacă e setat.
        </p>
      </div>

      <AssistantClient
        configured={isAssistantLlmConfigured()}
        displayName={barber.display_name || ""}
      />
    </div>
  );
}
