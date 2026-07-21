import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { isPlatformCreatorEmail } from "@/lib/auth/requirePlatformCreator";
import {
  isPlatformAssistantEnabled,
  isPlatformAssistantLlmConfigured,
} from "@/lib/platform-assistant/config";
import AssistantChatPanel from "../components/AssistantChatPanel";
import {
  buildPlatformWelcomeMessage,
} from "../components/assistantChatStorage";

const PLATFORM_SUGGESTIONS = [
  "Ce am azi pe platformă?",
  "Follow-up trial — pe cine scriu?",
  "Prelungește trial cu 7 zile",
  "Cine e past_due?",
];

export default async function PlatformAssistantPage() {
  if (!isPlatformAssistantEnabled()) {
    redirect("/admin/dashboard");
  }

  const user = await getAuthUser();
  if (!user || !isPlatformCreatorEmail(user.email)) {
    redirect("/admin/dashboard");
  }

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <div className="inline-flex items-center gap-2 text-xs text-sky-300/90 bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 rounded-full mb-3">
          Creator only · plan / trial cu confirmare
        </div>
        <h1 className="text-2xl font-semibold">Platform Assistant</h1>
        <p className="text-white/60 mt-1">
          Asistent intern pentru administrarea Frizeo.ro — briefing, follow-up
          trial, planuri. Separat de asistentul de salon.
        </p>
      </div>

      <div className="h-[min(75vh,700px)] overflow-hidden rounded-xl border border-white/10 bg-[#161618]">
        <AssistantChatPanel
          configured={isPlatformAssistantLlmConfigured()}
          displayName="Maris"
          apiPath="/api/platform-assistant/chat"
          storageNamespace="platform"
          welcomeMessage={buildPlatformWelcomeMessage()}
          suggestions={PLATFORM_SUGGESTIONS}
          className="h-full"
        />
      </div>
    </div>
  );
}
