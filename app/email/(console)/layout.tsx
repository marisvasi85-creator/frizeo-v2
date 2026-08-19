import type { Metadata } from "next";
import { redirect } from "next/navigation";
import EmailSidebar from "./components/EmailSidebar";
import EmailMobileNav from "./components/EmailMobileNav";
import { getEmailSession } from "@/lib/frizeo-email/access";
import { getFrizeoAppUrl } from "@/lib/frizeo-email/config";

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

  return (
    <div className="frz-admin-light flex min-h-screen min-w-0 max-w-[100vw] overflow-x-clip bg-frz-fog text-frz-ink">
      <EmailSidebar backUrl={`${frizeoUrl}/admin/dashboard`} />
      <main className="flex-1 min-w-0 p-6 md:p-10 pb-24 md:pb-10 bg-frz-fog">
        {children}
      </main>
      <EmailMobileNav />
    </div>
  );
}
