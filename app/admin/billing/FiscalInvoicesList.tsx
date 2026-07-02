import { supabaseAdmin } from "@/lib/supabase/admin";
import AdminCard from "../components/AdminCard";

export default async function FiscalInvoicesList({
  tenantId,
}: {
  tenantId: string;
}) {
  const { data: invoices } = await supabaseAdmin
    .from("tenant_fiscal_invoices")
    .select(
      "id, amount_ron, status, fgo_serie, fgo_numar, fgo_pdf_url, error_message, issued_at, created_at",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(12);

  if (!invoices?.length) {
    return null;
  }

  return (
    <AdminCard>
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Facturi fiscale</h2>
          <p className="text-sm text-white/60 mt-1">
            Emise automat via FGO după plata abonamentului Stripe.
          </p>
        </div>

        <div className="space-y-3">
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="rounded-lg border border-white/10 bg-[#0F0F10] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div>
                <p className="font-medium">
                  {invoice.fgo_serie && invoice.fgo_numar
                    ? `${invoice.fgo_serie} ${invoice.fgo_numar}`
                    : "Factură FGO"}
                </p>
                <p className="text-sm text-white/60">
                  {Number(invoice.amount_ron).toFixed(2)} lei ·{" "}
                  {invoice.status === "issued" ? "Emisă" : "Eșuată"}
                </p>
                {invoice.status === "failed" && invoice.error_message && (
                  <p className="text-xs text-red-400 mt-1">{invoice.error_message}</p>
                )}
              </div>

              {invoice.fgo_pdf_url && (
                <a
                  href={invoice.fgo_pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-white underline underline-offset-2"
                >
                  Descarcă PDF
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </AdminCard>
  );
}
