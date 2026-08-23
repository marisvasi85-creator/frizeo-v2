import type { Metadata } from "next";
import { headers } from "next/headers";
import { getAppUrlForRequest } from "@/lib/app/getAppUrl";
import { accessRequestDashboardUrl } from "@/lib/barber-access/requestNotification";
import { getQuickApprovalView } from "@/lib/barber-access/quickApprovalServer";
import QuickApprovalCard from "./QuickApprovalCard";

export const metadata: Metadata = {
  title: "Cerere de acces | Frizeo",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

export default async function AccessRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ token = "" }, requestHeaders] = await Promise.all([
    searchParams,
    headers(),
  ]);
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") === "http" ? "http" : "https";
  const appUrl = host
    ? getAppUrlForRequest(`${proto}://${host}`)
    : getAppUrlForRequest("http://localhost:3000");
  const view = await getQuickApprovalView(token);
  const dashboardUrl = view.barberId
    ? accessRequestDashboardUrl(view.barberId, appUrl)
    : `${appUrl}/admin/client-access`;

  return (
    <QuickApprovalCard
      initialState={view.state}
      token={view.state === "pending" ? token : ""}
      dashboardUrl={dashboardUrl}
      barberName={view.barberName}
      clientName={view.clientName}
      clientPhone={displayPhone(view.clientPhone)}
      clientEmail={view.clientEmail}
      referral={view.referral}
      message={view.message}
    />
  );
}

function displayPhone(value: string | null): string | null {
  if (!value) return null;
  return value.startsWith("40") ? `+${value}` : value;
}
