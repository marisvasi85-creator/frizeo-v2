import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Sidebar from "./components/Sidebar";
import MobileNav from "./components/MobileNav";
import FloatingAssistant from "./components/FloatingAssistant";
import InstallAppPrompt from "@/app/components/pwa/InstallAppPrompt";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import { sessionActsAsBarber } from "./components/adminNav";
import {
  isAssistantLlmConfigured,
  isFrizeoAssistantEnabled,
} from "@/lib/assistant/config";
import { isPlatformAssistantEnabled } from "@/lib/platform-assistant/config";
import { isPlatformCreatorEmail } from "@/lib/auth/requirePlatformCreator";
import { isPlatformAdminEmail } from "@/lib/auth/requirePlatformAdmin";
import { pwaManifestHref } from "@/lib/pwa/manifestContent";
import { SITE_NAME } from "@/lib/site/metadata";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  manifest: pwaManifestHref({
    startUrl: "/admin/dashboard",
    variant: "admin",
  }),
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "default",
  },
  icons: {
    apple: "/apple-icon",
    icon: [{ url: "/pwa-icon-192", sizes: "192x192", type: "image/png" }],
  },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/login");
  }

  if (!session.role) {
    redirect("/login?error=access");
  }

  const actsAsBarber = sessionActsAsBarber(session);
  const assistantEnabled = isFrizeoAssistantEnabled();
  const platformAssistantEnabled =
    isPlatformAssistantEnabled() &&
    isPlatformCreatorEmail(session.user.email);
  const frizeoEmailEnabled = isPlatformAdminEmail(session.user.email);

  return (
    <div className="frz-admin-light flex min-h-screen min-w-0 max-w-[100vw] overflow-x-clip bg-frz-fog text-frz-ink">
      <Sidebar
        role={session.role}
        actsAsBarber={actsAsBarber}
        assistantEnabled={assistantEnabled}
        platformAssistantEnabled={platformAssistantEnabled}
        frizeoEmailEnabled={frizeoEmailEnabled}
      />

      <main className="flex-1 min-w-0 p-6 md:p-10 pb-20 md:pb-10 bg-frz-fog">
        {children}
      </main>

      <MobileNav
        role={session.role}
        actsAsBarber={actsAsBarber}
        assistantEnabled={assistantEnabled}
        platformAssistantEnabled={platformAssistantEnabled}
        frizeoEmailEnabled={frizeoEmailEnabled}
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
