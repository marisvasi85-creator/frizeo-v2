import { NextResponse } from "next/server";
import { requirePlatformCreator } from "@/lib/auth/requirePlatformCreator";
import { REFUND_MESSAGES } from "@/lib/billing/refundDecisions";
import {
  executeTenantRefundForAdmin,
  inspectTenantRefundForAdmin,
  loadLocalSubscription,
} from "@/lib/billing/refundRuntime";
import type { RefundInspection } from "@/lib/billing/subscriptionRefund";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const TENANT_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function messageFor(code: string): string {
  return REFUND_MESSAGES[code] ?? "Refund oprit.";
}

function refundView(inspection: RefundInspection) {
  const plan = inspection.plan;
  const invoice = inspection.invoice;
  const refunded =
    plan.type === "stop" &&
    (plan.code === "already_refunded" || plan.code === "reconciled")
      ? "full"
      : plan.type === "stop" && plan.code === "partially_refunded"
        ? "partial"
        : plan.type === "stop" && plan.code === "action_required"
          ? "action_required"
          : plan.type === "resume"
            ? "full"
            : "none";

  return {
    tenant: inspection.local
      ? {
          id: inspection.local.tenantId,
          name: inspection.local.tenantName,
          slug: inspection.local.tenantSlug,
        }
      : null,
    subscription: inspection.local
      ? {
          planName: inspection.local.planName,
          planSlug: inspection.local.planSlug,
          status: inspection.local.status,
          stripeStatus: inspection.stripeStatus,
          stripeCustomerId: inspection.local.stripeCustomerId,
          stripeSubscriptionId: inspection.local.stripeSubscriptionId,
        }
      : null,
    invoice: invoice
      ? {
          id: invoice.id,
          amount: invoice.amountPaid,
          currency: invoice.currency,
          paidAt: invoice.paidAt,
          status: invoice.status,
          refunded,
        }
      : null,
    canRefund: plan.type === "create_refund" || plan.type === "resume",
    resumeOnly: plan.type === "resume",
    blockCode: plan.type === "stop" ? plan.code : null,
    blockMessage: plan.type === "stop" ? messageFor(plan.code) : null,
  };
}

export async function GET(req: Request) {
  const auth = await requirePlatformCreator();
  if (!auth.ok) return auth.response;

  const limited = await enforceRateLimit(req, {
    bucket: "admin-billing-refund-read",
    limit: 30,
    windowSeconds: 60,
    identifier: auth.userId,
  });
  if (limited) return limited;

  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenantId")?.trim() ?? "";
  const query = url.searchParams.get("q")?.trim() ?? "";

  try {
    if (tenantId) {
      if (!TENANT_UUID.test(tenantId)) {
        return NextResponse.json({ error: messageFor("invalid_input") }, { status: 400 });
      }
      const inspection = await inspectTenantRefundForAdmin(tenantId);
      if (!inspection.local) {
        return NextResponse.json({ error: "Salonul nu există." }, { status: 404 });
      }
      return NextResponse.json(refundView(inspection));
    }

    const safe = query.replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 60);
    if (safe.length < 2) {
      return NextResponse.json(
        { error: "Scrie cel puțin 2 caractere din numele sau slug-ul salonului." },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("tenants")
      .select("id, name, slug")
      .or(`name.ilike.%${safe}%,slug.ilike.%${safe}%`)
      .limit(8);

    if (error) {
      console.error("admin billing refund search", error.message);
      return NextResponse.json({ error: "Căutarea a eșuat." }, { status: 500 });
    }

    const tenants = [];
    for (const tenant of data ?? []) {
      const local = await loadLocalSubscription(tenant.id);
      tenants.push({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        planName: local?.planName ?? null,
        planSlug: local?.planSlug ?? null,
        status: local?.status ?? null,
        hasStripeSubscription: Boolean(local?.stripeSubscriptionId),
      });
    }

    return NextResponse.json({ tenants });
  } catch (err) {
    if (err instanceof Error && err.message.includes("STRIPE_SECRET_KEY")) {
      return NextResponse.json(
        { error: "Stripe nu este configurat pe acest mediu." },
        { status: 503 },
      );
    }
    console.error("admin billing refund read", err);
    return NextResponse.json({ error: "Nu am putut citi billing-ul." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requirePlatformCreator();
  if (!auth.ok) return auth.response;

  const limited = await enforceRateLimit(req, {
    bucket: "admin-billing-refund",
    limit: 5,
    windowSeconds: 60,
    identifier: auth.userId,
  });
  if (limited) return limited;

  let body: { tenantId?: unknown; confirm?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: messageFor("invalid_input") }, { status: 400 });
  }

  const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
  if (!TENANT_UUID.test(tenantId) || body.confirm !== true) {
    return NextResponse.json(
      {
        error: body.confirm === true ? messageFor("invalid_input") : messageFor("confirm_required"),
      },
      { status: 400 },
    );
  }

  try {
    const outcome = await executeTenantRefundForAdmin({
      tenantId,
      actorUserId: auth.userId,
      actorEmail: auth.email,
    });

    if (!outcome.ok) {
      return NextResponse.json(
        {
          error: messageFor(outcome.code),
          code: outcome.code,
          retryable: outcome.retryable,
          refunded: Boolean(outcome.refundId),
        },
        { status: outcome.retryable ? 409 : 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      code: outcome.code,
      refundId: outcome.refundId,
      invoiceId: outcome.invoiceId,
      amount: outcome.amount,
      currency: outcome.currency,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("STRIPE_SECRET_KEY")) {
      return NextResponse.json(
        { error: "Stripe nu este configurat pe acest mediu." },
        { status: 503 },
      );
    }
    console.error("admin billing refund", err);
    return NextResponse.json(
      { error: "Refund-ul nu a putut fi finalizat." },
      { status: 500 },
    );
  }
}
