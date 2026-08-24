import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ANALYTICS_RANGES,
  getOwnerAnalyticsDashboard,
  parseAnalyticsRange,
  type AnalyticsDashboard,
} from "@/lib/analytics/dashboard";
import { isAnalyticsOwnerEmail } from "@/lib/analytics/ownerAccess";
import { getEmailSession } from "@/lib/frizeo-email/access";
import { emailHref } from "../components/emailNav";

type PageProps = {
  searchParams: Promise<{ range?: string }>;
};

const SOURCE_LABELS: Record<string, string> = {
  direct: "Direct",
  frizeo_email: "Frizeo Email",
  google: "Google",
  meta: "Meta",
  tiktok: "TikTok",
  unknown: "Necunoscut",
};

const EVENT_LABELS: Record<string, string> = {
  page_view: "Vizită pagină",
  signup_view: "A văzut pagina de cont",
  pricing_view: "A văzut prețurile",
  lead: "Lead",
  plan_selected: "A ales un plan",
  checkout_started: "A început plata",
  signup: "Cont creat",
  trial_started: "Trial început",
  subscription_started: "Abonament pornit",
};

function number(value: number): string {
  return new Intl.NumberFormat("ro-RO").format(value);
}

function percent(numerator: number, denominator: number): string {
  if (denominator <= 0) return "—";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] || source;
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-frz-line bg-frz-card px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-frz-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
      {detail && <p className="mt-1 text-xs text-frz-muted">{detail}</p>}
    </div>
  );
}

function SourceTable({ sources }: { sources: AnalyticsDashboard["sources"] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-frz-line">
      <table className="min-w-full text-sm">
        <thead className="bg-frz-fog text-left text-frz-muted">
          <tr>
            <th className="px-4 py-3 font-medium">Sursă</th>
            <th className="px-4 py-3 font-medium">Vizitatori</th>
            <th className="px-4 py-3 font-medium">Sesiuni</th>
            <th className="px-4 py-3 font-medium">Lead-uri</th>
            <th className="px-4 py-3 font-medium">Conturi</th>
            <th className="px-4 py-3 font-medium">Trial-uri</th>
            <th className="px-4 py-3 font-medium">Plătite</th>
          </tr>
        </thead>
        <tbody>
          {sources.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-frz-muted">
                Datele de trafic vor apărea după primele vizite cu analytics
                acceptat.
              </td>
            </tr>
          ) : (
            sources.map((source) => (
              <tr key={source.source} className="border-t border-frz-line/60">
                <td className="px-4 py-3 font-medium">
                  {sourceLabel(source.source)}
                </td>
                <td className="px-4 py-3 tabular-nums">{number(source.visitors)}</td>
                <td className="px-4 py-3 tabular-nums">{number(source.sessions)}</td>
                <td className="px-4 py-3 tabular-nums">{number(source.leads)}</td>
                <td className="px-4 py-3 tabular-nums">{number(source.signups)}</td>
                <td className="px-4 py-3 tabular-nums">{number(source.trials)}</td>
                <td className="px-4 py-3 tabular-nums">{number(source.paid)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function DailyChart({ daily }: { daily: AnalyticsDashboard["daily"] }) {
  const visible = daily.slice(-30);
  const max = Math.max(1, ...visible.map((item) => item.page_views));
  return (
    <div className="rounded-xl border border-frz-line bg-frz-card p-5">
      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-frz-muted">
          Nu există încă trafic first-party în interval.
        </p>
      ) : (
        <div className="space-y-3">
          {visible.map((item) => (
            <div
              key={item.day}
              className="grid grid-cols-[76px_1fr_42px] items-center gap-3 text-xs"
            >
              <span className="text-frz-muted tabular-nums">
                {new Date(`${item.day}T12:00:00`).toLocaleDateString("ro-RO", {
                  day: "2-digit",
                  month: "short",
                })}
              </span>
              <div className="h-2.5 overflow-hidden rounded-full bg-frz-fog">
                <div
                  className="h-full rounded-full bg-frz-ink"
                  style={{ width: `${(item.page_views / max) * 100}%` }}
                />
              </div>
              <span className="text-right tabular-nums">{item.page_views}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function OwnerAnalyticsPage({ searchParams }: PageProps) {
  const session = await getEmailSession();
  if (!session.ok || !isAnalyticsOwnerEmail(session.email)) {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    redirect(emailHref("/", { host }));
  }
  const { range: rangeParam } = await searchParams;
  const range = parseAnalyticsRange(rangeParam);
  let data: AnalyticsDashboard | null = null;
  let loadError: string | null = null;
  try {
    data = await getOwnerAnalyticsDashboard(range);
  } catch (error) {
    console.error("[owner-analytics] dashboard failed", error);
    loadError =
      "Dashboardul nu poate fi încărcat momentan. Verifică migrarea Supabase pentru Etapa 1.";
  }

  const traffic = data?.traffic ?? {
    page_views: 0,
    visitors: 0,
    sessions: 0,
    leads: 0,
    signup_views: 0,
    pricing_views: 0,
  };
  const conversions = data?.conversions ?? {
    signups: 0,
    trials: 0,
    paid: 0,
    mrr: 0,
    currency: "RON",
  };
  const email = data?.email ?? {
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    unsubscribed: 0,
  };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Trafic & conversii
            </h1>
            <span className="rounded-full border border-frz-line px-2 py-1 text-[10px] uppercase tracking-wide text-frz-muted">
              Owner only
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-frz-muted">
            Un singur traseu Frizeo de la vizită la trial și abonament, fără să
            adunăm aceeași conversie raportată de mai mulți pixeli.
          </p>
        </div>
        <div className="flex rounded-lg border border-frz-line bg-frz-card p-1">
          {ANALYTICS_RANGES.map((days) => (
            <Link
              key={days}
              href={emailHref(`/analytics?range=${days}`, { host })}
              className={`rounded-md px-3 py-1.5 text-xs transition ${
                range === days
                  ? "bg-frz-ink text-frz-ink-contrast"
                  : "text-frz-muted hover:text-frz-ink"
              }`}
            >
              {days === 1 ? "24h" : `${days} zile`}
            </Link>
          ))}
        </div>
      </header>

      {loadError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {loadError}
        </div>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">Trafic Frizeo</h2>
          <p className="text-sm text-frz-muted">
            Trafic first-party măsurat numai după acceptarea analytics. Nu
            stocăm email, telefon, adresă IP sau user-agent brut.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard label="Vizitatori" value={number(traffic.visitors)} />
          <StatCard label="Sesiuni" value={number(traffic.sessions)} />
          <StatCard label="Pagini văzute" value={number(traffic.page_views)} />
          <StatCard label="Lead-uri" value={number(traffic.leads)} />
          <StatCard label="Vizite signup" value={number(traffic.signup_views)} />
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">Funnel canonic</h2>
          <p className="text-sm text-frz-muted">
            Fiecare cont, trial și abonament este numărat o singură dată în
            baza Frizeo.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Conturi create"
            value={number(conversions.signups)}
            detail={`${percent(conversions.signups, traffic.signup_views)} din vizitele signup`}
          />
          <StatCard
            label="Trial-uri"
            value={number(conversions.trials)}
            detail={`${percent(conversions.trials, conversions.signups)} din conturi`}
          />
          <StatCard
            label="Abonamente"
            value={number(conversions.paid)}
            detail={`${percent(conversions.paid, conversions.trials)} din trial-uri`}
          />
          <StatCard
            label="MRR nou"
            value={`${number(conversions.mrr)} ${conversions.currency}`}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">Surse</h2>
          <p className="text-sm text-frz-muted">
            UTM, click ID sau referrer; emailul Frizeo are prioritate când
            există un click atribuit.
          </p>
        </div>
        <SourceTable sources={data?.sources ?? []} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-medium">Evoluție trafic</h2>
            <p className="text-sm text-frz-muted">Pagini văzute pe zi.</p>
          </div>
          <DailyChart daily={data?.daily ?? []} />
        </div>
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-medium">Frizeo Email</h2>
            <p className="text-sm text-frz-muted">Evenimente verificate Resend.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Trimise" value={number(email.sent)} />
            <StatCard label="Livrate" value={number(email.delivered)} />
            <StatCard label="Deschise" value={number(email.opened)} />
            <StatCard label="Click-uri" value={number(email.clicked)} />
            <StatCard label="Bounced" value={number(email.bounced)} />
            <StatCard label="Dezabonări" value={number(email.unsubscribed)} />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">Activitate recentă</h2>
          <p className="text-sm text-frz-muted">
            Doar evenimente interne, fără identitatea vizitatorului.
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border border-frz-line bg-frz-card">
          {(data?.recent ?? []).length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-frz-muted">
              Nu există activitate în interval.
            </p>
          ) : (
            <ul className="divide-y divide-frz-line/60">
              {data?.recent.map((event, index) => (
                <li
                  key={`${event.occurred_at}-${event.event_name}-${index}`}
                  className="flex items-center justify-between gap-4 px-5 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {EVENT_LABELS[event.event_name] || event.event_name}
                    </p>
                    <p className="truncate text-xs text-frz-muted">
                      {sourceLabel(event.source)}
                      {event.path ? ` · ${event.path}` : ""}
                    </p>
                  </div>
                  <time className="shrink-0 text-xs tabular-nums text-frz-muted">
                    {new Date(event.occurred_at).toLocaleString("ro-RO", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
