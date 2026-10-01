import Link from "next/link";
import { redirect } from "next/navigation";
import AdminButton from "@/app/admin/components/AdminButton";
import AdminCard from "@/app/admin/components/AdminCard";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import { AdminInput, AdminLabel } from "@/app/admin/components/AdminInput";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { isPlatformCreatorEmail } from "@/lib/auth/requirePlatformCreator";
import { loadAccountingReport } from "@/lib/accounting/loadReport";
import { currencyScale } from "@/lib/accounting/money";
import {
  parseAccountingQuery,
  type AccountingPeriod,
} from "@/lib/accounting/period";
import type { AccountingReport, AccountingStatus } from "@/lib/accounting/types";
import { stripeErrorMessage } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function formatAmount(value: number | null, currency: string): string {
  if (value == null) return "—";
  const scale = currencyScale(currency);
  const digits = scale === 1 ? 0 : scale === 1000 ? 3 : 2;
  try {
    return new Intl.NumberFormat("ro-RO", {
      style: "currency",
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  } catch {
    return `${value.toFixed(digits)} ${currency}`;
  }
}

function show(value: string | null | undefined): string {
  return value?.trim() ? value : "—";
}

const STATUS_CLASS: Record<AccountingStatus, string> = {
  PAID: "bg-emerald-50 text-emerald-800 border-emerald-200",
  PARTIALLY_REFUNDED: "bg-amber-50 text-amber-800 border-amber-200",
  REFUNDED: "bg-rose-50 text-rose-800 border-rose-200",
};

const COLUMNS = [
  "Data plății",
  "Salon / Client",
  "Denumire firmă",
  "CUI/CIF/VAT ID",
  "Email",
  "Adresă facturare",
  "Țară",
  "Plan",
  "Perioadă abonament",
  "Stripe Customer ID",
  "Stripe Subscription ID",
  "Stripe Invoice ID",
  "Stripe Invoice Number",
  "PaymentIntent / Charge ID",
  "Monedă",
  "Subtotal",
  "TVA/Tax",
  "Total",
  "Sumă plătită",
  "Sumă refundată",
  "Net după refund",
  "Status",
] as const;

export default async function AccountingPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string | string[];
    from?: string | string[];
    to?: string | string[];
  }>;
}) {
  const user = await getAuthUser();
  if (!user || !isPlatformCreatorEmail(user.email)) {
    redirect("/admin/dashboard");
  }

  const raw = await searchParams;
  const month = first(raw.month);
  const from = first(raw.from);
  const to = first(raw.to);
  const query = new URLSearchParams();
  if (month) query.set("month", month);
  if (from) query.set("from", from);
  if (to) query.set("to", to);

  const parsed = parseAccountingQuery(query);
  let report: AccountingReport | null = null;
  let error: string | null = parsed.ok ? null : parsed.error;

  if (parsed.ok) {
    try {
      report = await loadAccountingReport(parsed.period);
    } catch (err) {
      console.error(
        "accounting page",
        err instanceof Error ? err.message : "error",
      );
      error = stripeErrorMessage(err);
    }
  }

  const period: AccountingPeriod | null = parsed.ok ? parsed.period : null;
  const usedRange = Boolean(from || to);
  const downloadHref = period
    ? `/api/admin/accounting/xlsx?from=${period.from}&to=${period.to}`
    : null;

  return (
    <div className="space-y-6 min-w-0">
      <div className="inline-flex items-center gap-2 text-xs text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-full">
        Creator only · export read-only Stripe, fără refund sau factură fiscală
      </div>
      <AdminPageHeader
        title="Contabilitate"
        subtitle="Plăți Stripe încasate, pentru contabil. Stripe Invoice nu este factură fiscală românească. TVA apare doar dacă Stripe a trimis taxa."
      />

      <AdminCard>
        <form method="get" className="grid gap-4 md:grid-cols-4 md:items-end">
          <div>
            <AdminLabel htmlFor="accounting-month">Luna</AdminLabel>
            <AdminInput
              id="accounting-month"
              name="month"
              type="month"
              defaultValue={usedRange ? month : (period?.from.slice(0, 7) ?? month)}
            />
          </div>
          <div>
            <AdminLabel htmlFor="accounting-from">De la</AdminLabel>
            <AdminInput
              id="accounting-from"
              name="from"
              type="date"
              defaultValue={usedRange ? from : ""}
            />
          </div>
          <div>
            <AdminLabel htmlFor="accounting-to">Până la</AdminLabel>
            <AdminInput
              id="accounting-to"
              name="to"
              type="date"
              defaultValue={usedRange ? to : ""}
            />
          </div>
          <AdminButton type="submit">Generează raportul</AdminButton>
        </form>
        <p className="text-xs text-frz-muted mt-3">
          Perioada este în Europe/Bucharest. Dacă completezi De la și Până la,
          intervalul are prioritate față de lună. Maxim 366 de zile.
        </p>
      </AdminCard>

      {error ? (
        <AdminCard>
          <p className="text-sm text-rose-700">{error}</p>
        </AdminCard>
      ) : null}

      {report && period ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-frz-muted">
              {period.from} – {period.to} · {period.timeZone} · generat{" "}
              {report.generatedAt} · {report.paymentCount} plăți
            </p>
            {downloadHref ? (
              <a
                href={downloadHref}
                className="inline-flex items-center justify-center rounded-xl bg-frz-card text-frz-ink font-medium border border-frz-line hover:bg-frz-fog px-5 py-3 text-sm min-h-11"
              >
                Descarcă XLSX
              </a>
            ) : null}
          </div>

          {report.totalsByCurrency.length === 0 ? (
            <AdminCard>
              <p className="text-sm text-frz-muted">
                Nicio plată încasată în perioada selectată.
              </p>
            </AdminCard>
          ) : (
            report.totalsByCurrency.map((total) => (
              <div key={total.currency} className="space-y-3">
                <h2 className="text-sm font-semibold tracking-wide text-frz-ink">
                  {total.currency}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <AdminCard padding="sm">
                    <div className="text-frz-ink/60 text-sm">Plăți reușite</div>
                    <div className="text-2xl font-semibold mt-1">
                      {total.paymentCount}
                    </div>
                  </AdminCard>
                  <AdminCard padding="sm">
                    <div className="text-frz-ink/60 text-sm">Total încasat</div>
                    <div className="text-2xl font-semibold mt-1">
                      {formatAmount(total.collected, total.currency)}
                    </div>
                  </AdminCard>
                  <AdminCard padding="sm">
                    <div className="text-frz-ink/60 text-sm">Total refundat</div>
                    <div className="text-2xl font-semibold mt-1">
                      {formatAmount(total.refunded, total.currency)}
                    </div>
                  </AdminCard>
                  <AdminCard padding="sm">
                    <div className="text-frz-ink/60 text-sm">Net după refund</div>
                    <div className="text-2xl font-semibold mt-1">
                      {formatAmount(total.net, total.currency)}
                    </div>
                  </AdminCard>
                </div>
              </div>
            ))
          )}

          <AdminCard className="min-w-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[1600px]">
                <thead>
                  <tr className="text-frz-ink/50 border-b border-frz-line">
                    {COLUMNS.map((column) => (
                      <th key={column} className="py-2 pr-3 font-medium whitespace-nowrap">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => {
                    const cells = [
                      row.paidAt,
                      show(row.salon),
                      show(row.company),
                      show(row.taxId),
                      show(row.email),
                      show(row.address),
                      show(row.country),
                      show(row.plan),
                      show(row.periodLabel),
                      show(row.stripeCustomerId),
                      show(row.stripeSubscriptionId),
                      show(row.stripeInvoiceId),
                      show(row.stripeInvoiceNumber),
                      show(row.paymentId),
                      row.currency,
                      formatAmount(row.subtotal, row.currency),
                      formatAmount(row.tax, row.currency),
                      formatAmount(row.total, row.currency),
                      formatAmount(row.paid, row.currency),
                      formatAmount(row.refunded, row.currency),
                      formatAmount(row.net, row.currency),
                    ];
                    return (
                      <tr
                        key={row.paymentId ?? `${row.paidAtUnix}`}
                        className="border-b border-frz-line/70 align-top"
                      >
                        {cells.map((cell, index) => (
                          <td key={COLUMNS[index]} className="py-2.5 pr-3 whitespace-nowrap">
                            {cell}
                          </td>
                        ))}
                        <td className="py-2.5 pr-3">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[row.status]}`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {report.rows.length === 0 ? (
              <p className="text-sm text-frz-muted mt-4">
                Nu există încasări de afișat.
              </p>
            ) : null}
          </AdminCard>

          <p className="text-xs text-frz-muted">
            Sursa sumelor este Stripe (charge reușit + refund-uri reușite).{" "}
            <Link href="/admin/billing" className="underline">
              Abonamentul salonului
            </Link>{" "}
            nu este modificat din această pagină.
          </p>
        </>
      ) : null}
    </div>
  );
}
