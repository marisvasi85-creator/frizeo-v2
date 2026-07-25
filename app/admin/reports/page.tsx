import Link from "next/link";
import { redirect } from "next/navigation";
import AdminCard from "@/app/admin/components/AdminCard";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import EmptyState from "@/app/admin/components/EmptyState";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import type { TenantRole } from "@/lib/auth/tenantRole";
import {
  parseReportsRange,
  REPORTS_RANGE_PRESETS,
} from "@/lib/reports/dateRange";
import { getReportsStats } from "@/lib/reports/getReportsStats";
import { cn } from "@/app/admin/components/cn";

function formatRon(value: number): string {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    maximumFractionDigits: 0,
  }).format(value);
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <AdminCard padding="sm">
      <div className="text-white/60 text-sm">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {hint ? <div className="text-white/40 text-xs mt-1">{hint}</div> : null}
    </AdminCard>
  );
}

function BreakdownTable({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: Array<{
    id: string;
    name: string;
    total: number;
    confirmed: number;
    cancelled: number;
  }>;
  emptyLabel: string;
}) {
  return (
    <AdminCard>
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      {rows.length === 0 ? (
        <EmptyState>{emptyLabel}</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[420px]">
            <thead>
              <tr className="text-white/50 border-b border-white/10">
                <th className="py-2 pr-3 font-medium">Nume</th>
                <th className="py-2 pr-3 font-medium text-right">Confirmate</th>
                <th className="py-2 pr-3 font-medium text-right">Anulate</th>
                <th className="py-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-white/5 last:border-0"
                >
                  <td className="py-2.5 pr-3 text-white">{row.name}</td>
                  <td className="py-2.5 pr-3 text-right text-white/80">
                    {row.confirmed}
                  </td>
                  <td className="py-2.5 pr-3 text-right text-white/80">
                    {row.cancelled}
                  </td>
                  <td className="py-2.5 text-right text-white/80">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminCard>
  );
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await getAdminSession();
  if (!session?.tenantId || !session.role) {
    redirect("/login");
  }

  const params = await searchParams;
  const range = parseReportsRange(params.range);
  const { stats, error } = await getReportsStats({
    userId: session.user.id,
    tenantId: session.tenantId,
    role: session.role as TenantRole,
    range,
  });

  const subtitle =
    session.role === "barber"
      ? "Statistici pe programările tale"
      : "Statistici pe programările salonului";

  return (
    <div className="space-y-6 min-w-0">
      <AdminPageHeader title="Rapoarte" subtitle={subtitle} />

      <div className="inline-flex rounded-lg border border-white/10 p-1 bg-[#0F0F10] flex-wrap">
        {REPORTS_RANGE_PRESETS.map((preset) => {
          const active = range === preset.value;
          return (
            <Link
              key={preset.value}
              href={`/admin/reports?range=${preset.value}`}
              className={cn(
                "px-4 py-2 text-sm rounded-md transition",
                active
                  ? "bg-white text-black font-medium"
                  : "text-white/60 hover:text-white",
              )}
            >
              {preset.label}
            </Link>
          );
        })}
      </div>

      {error || !stats ? (
        <EmptyState>{error || "Nu am putut încărca statisticile."}</EmptyState>
      ) : (
        <>
          <p className="text-white/50 text-sm">
            Perioadă: {stats.from === stats.to ? stats.from : `${stats.from} → ${stats.to}`}
            {" · "}
            {stats.rangeLabel}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            <MetricCard label="Confirmate" value={stats.metrics.confirmed} />
            <MetricCard label="Anulate" value={stats.metrics.cancelled} />
            <MetricCard
              label="Total"
              value={stats.metrics.total}
              hint={
                stats.metrics.pending > 0
                  ? `inclusiv ${stats.metrics.pending} pending`
                  : undefined
              }
            />
            <MetricCard
              label="Clienți unici"
              value={stats.metrics.uniqueClients}
              hint="după telefon / email"
            />
            <MetricCard
              label="Venit estimat"
              value={
                stats.metrics.estimatedRevenueRon != null
                  ? formatRon(stats.metrics.estimatedRevenueRon)
                  : "—"
              }
              hint="din prețurile serviciilor confirmate"
            />
          </div>

          {stats.byBarber ? (
            <BreakdownTable
              title="Pe frizer"
              rows={stats.byBarber}
              emptyLabel="Nicio programare în perioada selectată."
            />
          ) : null}

          <BreakdownTable
            title="Pe serviciu"
            rows={stats.byService}
            emptyLabel="Nicio programare cu serviciu în perioada selectată."
          />
        </>
      )}
    </div>
  );
}
