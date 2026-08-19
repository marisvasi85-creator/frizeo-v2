import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import {
  isAssistantLlmConfigured,
  isFrizeoAssistantEnabled,
} from "@/lib/assistant/config";
import AssistantChatPanel from "../components/AssistantChatPanel";

export default async function AssistantPage() {
  if (!isFrizeoAssistantEnabled()) {
    redirect("/admin/dashboard");
  }

  const session = await getAdminSession();
  if (!session?.barber) redirect("/login");

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <div className="inline-flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full mb-3">
          Staging · chat helper
        </div>
        <h1 className="text-2xl font-semibold">Frizeo Assistant</h1>
        <p className="text-frz-ink/60 mt-1">
          Același chat ca butonul flotant — programări, servicii, acțiuni cu
          confirmare. Preț opțional. Fără încasări.
        </p>
      </div>

      <div className="h-[min(75vh,700px)] overflow-hidden rounded-xl border border-frz-line bg-frz-card">
        <AssistantChatPanel
          configured={isAssistantLlmConfigured()}
          displayName={session.barber.display_name || ""}
          className="h-full"
        />
      </div>
    </div>
  );
}
