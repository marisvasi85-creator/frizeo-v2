import { redirect } from "next/navigation";
import Sidebar from "./components/Sidebar";
import MobileNav from "./components/MobileNav";
import FloatingAssistant from "./components/FloatingAssistant";
import InstallAppPrompt from "@/app/components/pwa/InstallAppPrompt";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import {
  isAssistantLlmConfigured,
  isFrizeoAssistantEnabled,
} from "@/lib/assistant/config";
import { isPlatformAssistantEnabled } from "@/lib/platform-assistant/config";
import { isPlatformCreatorEmail } from "@/lib/auth/requirePlatformCreator";
import { noIndexMetadata } from "@/lib/site/pageMetadata";

export const metadata = noIndexMetadata;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/login");
  }

  const assistantEnabled = isFrizeoAssistantEnabled();
  const platformAssistantEnabled =
    isPlatformAssistantEnabled() &&
    isPlatformCreatorEmail(session.user.email);

  return (
    <div className="flex min-h-screen min-w-0 max-w-[100vw] overflow-x-clip bg-[#0B0B0C] text-white">
      <Sidebar
        role={session.role}
        assistantEnabled={assistantEnabled}
        platformAssistantEnabled={platformAssistantEnabled}
      />

      <main className="flex-1 min-w-0 p-6 md:p-10 pb-20 md:pb-10 bg-[#0F0F10]">
        {children}
      </main>

      <MobileNav
        role={session.role}
        assistantEnabled={assistantEnabled}
        platformAssistantEnabled={platformAssistantEnabled}
      />
      {assistantEnabled && (
        <FloatingAssistant
          configured={isAssistantLlmConfigured()}
          displayName={session.barber?.display_name || ""}
        />
      )}
      <InstallAppPrompt variant="admin" />
    </div>
  );
}
