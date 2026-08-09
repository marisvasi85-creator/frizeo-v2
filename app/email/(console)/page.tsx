import Link from "next/link";
import { getContactStats } from "@/lib/frizeo-email/contacts";
import { getCampaignDashboardData } from "@/lib/frizeo-email/campaigns";

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-white/45">{label}</p>
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
    campaignsSent: 0,
    recent: [],
  };
  try {
    [stats, campaignData] = await Promise.all([
      getContactStats(),
      getCampaignDashboardData(),
    ]);
  } catch (e) {
    loadError =
      e instanceof Error
        ? e.message
        : "Nu am putut încărca statisticile (rulează migrarea Supabase).";
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <header>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Dashboard
        </h1>
        <p className="mt-2 text-white/55 text-sm max-w-2xl">
          Sistem intern de email marketing Frizeo. Faza 2 permite pregătirea
          campaniilor și snapshot-uri, fără trimitere în masă.
        </p>
      </header>

      {loadError && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {loadError}
        </div>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Total Contacts" value={stats.total} />
        <StatCard label="Subscribed" value={stats.subscribed} />
        <StatCard label="Unsubscribed" value={stats.unsubscribed} />
        <StatCard label="Emails Sent" value={campaignData.emailsSent} />
        <StatCard label="Campaigns Sent" value={campaignData.campaignsSent} />
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">Recent Campaigns</h2>
            <p className="text-sm text-white/45">
              Drafturi și campanii recente.
            </p>
          </div>
          <Link
            href="/email/campaigns"
            className="text-sm text-white/70 hover:text-white"
          >
            Vezi Campaigns →
          </Link>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-sm">
            <thead className="bg-white/[0.04] text-white/50 text-left">
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
                    className="px-4 py-10 text-center text-white/40"
                  >
                    Nu există campanii recente.
                  </td>
                </tr>
              ) : (
                campaignData.recent.map((campaign) => (
                  <tr key={campaign.id} className="border-t border-white/5">
                    <td className="px-4 py-3">
                      <Link
                        href={`/email/campaigns/${campaign.id}`}
                        className="font-medium hover:underline"
                      >
                        {campaign.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-white/60">
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
                    <td className="px-4 py-3 text-white/50">
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

      <section className="rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4 text-sm text-white/60">
        <p>
          Cu consimțământ marketing:{" "}
          <span className="text-white font-medium">{stats.withConsent}</span>
          {" · "}
          Bounced: <span className="text-white font-medium">{stats.bounced}</span>
          {" · "}
          Complained:{" "}
          <span className="text-white font-medium">{stats.complained}</span>
        </p>
      </section>
    </div>
  );
}
