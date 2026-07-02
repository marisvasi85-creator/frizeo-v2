import type Stripe from "stripe";
import {
  isBillingProfileComplete,
  rowToBillingProfile,
  type TenantBillingRow,
} from "@/lib/billing/billingProfile";
import { getPlanSlugFromStripePriceId } from "@/lib/billing/stripePrices";
import { PLAN_SLUGS } from "@/lib/billing/plans";
import { isFgoConfigured } from "@/lib/fgo/config";
import { emitFgoInvoice } from "@/lib/fgo/client";
import { mapTenantToFgoClient } from "@/lib/fgo/mapTenantToClient";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BILLING_COLUMNS =
  "billing_type, billing_name, billing_cui, billing_reg_com, billing_address_line1, billing_city, billing_county, billing_postal_code, billing_country";

const PLAN_LABELS: Record<string, string> = {
  [PLAN_SLUGS.PRO]: "Pro",
  [PLAN_SLUGS.PRO_PLUS]: "Pro+",
};

function formatIssueDate(unixSeconds: number | null | undefined): string {
  const date = unixSeconds ? new Date(unixSeconds * 1000) : new Date();
  return date.toISOString().slice(0, 10);
}

function planLabelFromInvoice(invoice: Stripe.Invoice): string {
  const line = invoice.lines.data[0];
  const priceRef = line?.pricing?.price_details?.price;

  if (typeof priceRef === "string") {
    const slug = getPlanSlugFromStripePriceId(priceRef);
    if (slug && PLAN_LABELS[slug]) {
      return PLAN_LABELS[slug];
    }
  }

  return line?.description?.trim() || "Abonament Frizeo";
}

export async function emitStripeSubscriptionInvoice(
  invoice: Stripe.Invoice,
  tenantId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isFgoConfigured()) {
    console.warn("FGO: skip emit — env vars missing");
    return { ok: false, error: "FGO not configured" };
  }

  if (!invoice.id || invoice.amount_paid <= 0) {
    return { ok: false, error: "Invoice not paid" };
  }

  const { data: existing } = await supabaseAdmin
    .from("tenant_fiscal_invoices")
    .select("id, status")
    .eq("stripe_invoice_id", invoice.id)
    .maybeSingle();

  if (existing?.status === "issued") {
    return { ok: true };
  }

  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from("tenants")
    .select(BILLING_COLUMNS)
    .eq("id", tenantId)
    .single();

  if (tenantError || !tenant) {
    return { ok: false, error: "Tenant not found" };
  }

  const profile = rowToBillingProfile(tenant as TenantBillingRow);

  if (!isBillingProfileComplete(profile)) {
    const message = "Profil facturare incomplet.";
    await upsertFiscalInvoiceRecord({
      tenantId,
      stripeInvoiceId: invoice.id,
      amountRon: invoice.amount_paid / 100,
      status: "failed",
      errorMessage: message,
    });
    return { ok: false, error: message };
  }

  const amountRon = Number((invoice.amount_paid / 100).toFixed(2));
  const planLabel = planLabelFromInvoice(invoice);
  const clientEmail =
    invoice.customer_email ??
    (typeof invoice.customer === "object" && invoice.customer && "email" in invoice.customer
      ? (invoice.customer.email as string | null)
      : null);

  try {
    const result = await emitFgoInvoice({
      idExtern: invoice.id,
      dataEmitere: formatIssueDate(invoice.status_transitions.paid_at),
      currency: (invoice.currency || "ron").toUpperCase(),
      client: mapTenantToFgoClient(profile, clientEmail),
      lines: [
        {
          Denumire: `Abonament Frizeo — ${planLabel} (lunar)`,
          NrProduse: 1,
          UM: "BUC",
          CotaTVA: Number(process.env.FGO_TVA ?? 21),
          PretTotal: amountRon,
        },
      ],
    });

    await upsertFiscalInvoiceRecord({
      tenantId,
      stripeInvoiceId: invoice.id,
      amountRon,
      status: "issued",
      fgoSerie: result.Factura?.Serie ?? null,
      fgoNumar: result.Factura?.Numar ?? null,
      fgoPdfUrl: result.Factura?.Link ?? null,
      errorMessage: null,
    });

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "FGO emit failed";
    console.error("emitStripeSubscriptionInvoice:", err);

    await upsertFiscalInvoiceRecord({
      tenantId,
      stripeInvoiceId: invoice.id,
      amountRon,
      status: "failed",
      errorMessage: message,
    });

    return { ok: false, error: message };
  }
}

async function upsertFiscalInvoiceRecord(params: {
  tenantId: string;
  stripeInvoiceId: string;
  amountRon: number;
  status: "issued" | "failed";
  fgoSerie?: string | null;
  fgoNumar?: string | null;
  fgoPdfUrl?: string | null;
  errorMessage?: string | null;
}) {
  const { error } = await supabaseAdmin.from("tenant_fiscal_invoices").upsert(
    {
      tenant_id: params.tenantId,
      stripe_invoice_id: params.stripeInvoiceId,
      amount_ron: params.amountRon,
      status: params.status,
      fgo_serie: params.fgoSerie ?? null,
      fgo_numar: params.fgoNumar ?? null,
      fgo_pdf_url: params.fgoPdfUrl ?? null,
      error_message: params.errorMessage ?? null,
      issued_at: params.status === "issued" ? new Date().toISOString() : null,
    },
    { onConflict: "stripe_invoice_id" },
  );

  if (error) {
    console.error("tenant_fiscal_invoices upsert:", error);
  }
}
