import Link from "next/link";
import { headers } from "next/headers";
import { getContactStats } from "@/lib/frizeo-email/contacts";
import { getCampaignDashboardData } from "@/lib/frizeo-email/campaigns";
import { getConversionStatsLastDays } from "@/lib/frizeo-email/attribution";
import { emailHref } from "./components/emailNav";

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-frz-line bg-frz-card px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-frz-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default async function EmailDashboardPage() {
  let stats = {
    total: 0,
    subscribed: 0,
    unsubscribed: 0,
    bounced: 0,
    complained: 0,
    withConsent: 0,
  };

  let loadError: string | null = null;
  let campaignData: Awaited<ReturnType<typeof getCampaignDashboardData>> = {
    emailsSent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    campaignsSent: 0,
    recent: [],
  };
  let conversions = {
    signups: 0,
    trials: 0,
    paid: 0,
    signup_rate: null as number | null,
    trial_rate: null as number | null,
    paid_rate: null as number | null,
    attributed_mrr: 0,
    currency: "RON",
  };
  try {
    [stats, campaignData, conversions] = await Promise.all([
      getContactStats(),
      getCampaignDashboardData(),
      getConversionStatsLastDays(30),
    ]);
  } catch (e) {
    loadError =
      e instanceof Error
        ? e.message
        : "Nu am putut încărca statisticile (rulează migrarea Supabase).";
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const campaignsHref = emailHref("/campaigns", { host });

  return (
    <div className="space-y-8 max-w-5xl">
      <header>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Dashboard
        </h1>
        <p className="mt-2 text-frz-muted text-sm max-w-2xl">
          Sistem intern de email marketing Frizeo, cu livrare și engagement
          actualizate din evenimentele verificate Resend.
        </p>
      </header>

      {loadError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {loadError}
        </div>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Total Contacts" value={stats.total} />
        <StatCard label="Subscribed" value={stats.subscribed} />
        <StatCard label="Emails Sent" value={campaignData.emailsSent} />
        <StatCard label="Delivered" value={campaignData.delivered} />
        <StatCard label="Opened" value={campaignData.opened} />
        <StatCard label="Clicked" value={campaignData.clicked} />
        <StatCard label="Bounces" value={campaignData.bounced} />
        <StatCard label="Unsubscribed" value={stats.unsubscribed} />
        <StatCard label="Campaigns Sent" value={campaignData.campaignsSent} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">Conversions — Last 30 days</h2>
          <p className="text-sm text-frz-muted">
            Last Frizeo Email click attribution
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Signups" value={conversions.signups} />
          <StatCard label="Trials" value={conversions.trials} />
          <StatCard label="Paid" value={conversions.paid} />
          <StatCard
            label="Attributed MRR"
            value={`${conversions.attributed_mrr.toFixed(0)} ${conversions.currency}`}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">Recent Campaigns</h2>
            <p className="text-sm text-frz-muted">
              Drafturi și campanii recente.
            </p>
          </div>
          <Link
            href={campaignsHref}
            className="text-sm text-frz-ink/70 hover:text-frz-ink"
          >
            Vezi Campaigns →
          </Link>
        </div>

        <div className="overflow-x-auto rounded-xl border border-frz-line">
          <table className="min-w-full text-sm">
            <thead className="bg-frz-fog text-frz-muted text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Campaign</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Recipients</th>
                <th className="px-4 py-3 font-medium">Sent</th>
                <th className="px-4 py-3 font-medium">Delivered</th>
                <th className="px-4 py-3 font-medium">Clicks</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {campaignData.recent.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-frz-muted"
                  >
                    Nu există campanii recente.
                  </td>
                </tr>
              ) : (
                campaignData.recent.map((campaign) => (
                  <tr key={campaign.id} className="border-t border-frz-line/50">
                    <td className="px-4 py-3">
                      <Link
                        href={emailHref(`/campaigns/${campaign.id}`, { host })}
                        className="font-medium hover:underline"
                      >
                        {campaign.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-frz-muted">
                      {campaign.status}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {campaign.recipient_count}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {campaign.sent_count}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {campaign.delivered_count}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {campaign.clicked_count}
                    </td>
                    <td className="px-4 py-3 text-frz-muted">
                      {new Date(
                        campaign.sent_at || campaign.created_at,
                      ).toLocaleDateString("ro-RO")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-frz-line bg-frz-card px-5 py-4 text-sm text-frz-muted">
        <p>
          Cu consimțământ marketing:{" "}
          <span className="text-frz-ink font-medium">{stats.withConsent}</span>
          {" · "}
          Bounced: <span className="text-frz-ink font-medium">{stats.bounced}</span>
          {" · "}
          Complained:{" "}
          <span className="text-frz-ink font-medium">{stats.complained}</span>
        </p>
      </section>
    </div>
  );
}
