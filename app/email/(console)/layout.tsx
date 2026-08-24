import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import EmailSidebar from "./components/EmailSidebar";
import EmailMobileNav from "./components/EmailMobileNav";
import { EmailPathProvider } from "./components/EmailPathContext";
import { getEmailSession } from "@/lib/frizeo-email/access";
import {
  getFrizeoAppUrl,
  isEmailHost,
} from "@/lib/frizeo-email/config";
import { isAnalyticsOwnerEmail } from "@/lib/analytics/ownerAccess";

export const metadata: Metadata = {
  title: "Frizeo Email",
  robots: { index: false, follow: false },
};

export default async function EmailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getEmailSession();
  const frizeoUrl = getFrizeoAppUrl();

  if (!session.ok) {
    if (session.reason === "unauthenticated") {
      redirect(`${frizeoUrl}/login?next=/api/email/sso`);
    }
    redirect(`${frizeoUrl}/admin/dashboard`);
  }

  const showOwnerAnalytics = isAnalyticsOwnerEmail(session.email);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const barePaths = isEmailHost(host);

  return (
    <EmailPathProvider barePaths={barePaths}>
      <div className="frz-admin flex min-h-screen min-w-0 max-w-[100vw] overflow-x-clip bg-frz-fog text-frz-ink">
        <EmailSidebar
          backUrl={`${frizeoUrl}/admin/dashboard`}
          showOwnerAnalytics={showOwnerAnalytics}
        />
        <main className="flex-1 min-w-0 p-6 md:p-10 pb-24 md:pb-10 bg-frz-fog">
          {children}
        </main>
        <EmailMobileNav showOwnerAnalytics={showOwnerAnalytics} />
      </div>
    </EmailPathProvider>
  );
}
