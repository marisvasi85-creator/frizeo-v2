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
  "Ce trebuie să fac astăzi?",
  "Cum stăm astăzi?",
  "Unde pierdem utilizatori?",
  "Cine merită un review?",
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
        <div className="inline-flex items-center gap-2 text-xs text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-full mb-3">
          Creator only · growth / trial / ops
        </div>
        <h1 className="text-2xl font-semibold">Growth Assistant</h1>
        <p className="text-frz-ink/60 mt-1">
          Conversie și retenție — plus ops (plan, trial, delete, SMS). Separat
          de asistentul de salon.
        </p>
      </div>

      <div className="h-[min(75vh,700px)] overflow-hidden rounded-xl border border-frz-line bg-frz-card">
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
