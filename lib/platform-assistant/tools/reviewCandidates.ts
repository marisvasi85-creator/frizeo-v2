import { getAppUrl } from "@/lib/app/getAppUrl";
import type { PlatformToolContext, PlatformToolResult } from "../types";
import { asBoolean, asNumber } from "./helpers";
import { loadGrowthSnapshot } from "../growth/snapshot";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { GrowthTenant } from "../growth/types";

function alreadyReviewed(
  tenant: GrowthTenant,
  names: Set<string>,
): boolean {
  const salon = tenant.name.trim().toLowerCase();
  if (salon && names.has(salon)) return true;
  if (tenant.owner_email && names.has(tenant.owner_email.toLowerCase())) {
    return true;
  }
  return false;
}

function scoreCandidate(tenant: GrowthTenant): {
  score: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  let score = 0;

  const recent = tenant.bookings_last_30d;
  score += Math.min(recent, 40) * 2;
  if (recent >= 20) reasons.push(`${recent} programări în ultimele 30 de zile`);
  else if (recent >= 8) reasons.push(`${recent} programări luna asta — folosește activ`);
  else if (recent >= 3) reasons.push(`${recent} programări recente`);

  if (tenant.bookings_ever >= 40) {
    score += 18;
    reasons.push(`${tenant.bookings_ever} programări all-time (fidel)`);
  } else if (tenant.bookings_ever >= 15) {
    score += 10;
    reasons.push(`${tenant.bookings_ever} programări all-time`);
  }

  const days = tenant.days_since_login ?? 99;
  if (days <= 3) {
    score += 22;
    reasons.push("login în ultimele 3 zile");
  } else if (days <= 7) {
    score += 14;
    reasons.push("login în ultima săptămână");
  } else if (days <= 14) {
    score += 6;
    reasons.push("login în ultimele 14 zile");
  }

  if (tenant.is_paid) {
    score += 20;
    reasons.push(
      tenant.has_stripe
        ? "convertit pe plan plătit (Stripe)"
        : `pe ${tenant.plan_name || "plan plătit"}`,
    );
  } else if (tenant.is_trialing && recent >= 5) {
    score += 8;
    reasons.push("trial activ cu uz real — bun și pentru review, și pentru conversie");
  }

  if (tenant.health_issues.length === 0) {
    score += 8;
    reasons.push("fără probleme de setup");
  }

  return { score, reasons };
}

function eligible(tenant: GrowthTenant, reviewed: Set<string>): boolean {
  if (alreadyReviewed(tenant, reviewed)) return false;
  if (!tenant.onboarded) return false;
  if (tenant.subscription_status === "past_due") return false;
  if (tenant.trial_expired) return false;
  if (!tenant.has_services || !tenant.has_working_schedule) return false;
  if (tenant.bookings_ever < 5) return false;
  if ((tenant.days_since_login ?? 99) > 21) return false;
  if (tenant.health_issues.some((h) => h === "past_due" || h === "trial expirat")) {
    return false;
  }
  return true;
}

function buildDraft(tenant: GrowthTenant): { subject: string; body: string } {
  const city = tenant.city ? ` din ${tenant.city}` : "";
  const first = tenant.owner_name?.split(" ")[0];
  const hello = first ? `Salut, ${first}!` : "Salut!";
  const usage =
    tenant.bookings_last_30d > 0
      ? `${tenant.bookings_last_30d} programări în ultimele 30 de zile`
      : `${tenant.bookings_ever} programări pe Frizeo`;
  const url = `${getAppUrl()}/review`;

  return {
    subject: `Un review scurt despre Frizeo? — ${tenant.name}`,
    body: `${hello}

Sunt Maris de la Frizeo.

Am văzut că ${tenant.name}${city} chiar folosește platforma (${usage}). Mă ajută enorm un review scurt de la cineva care lucrează zilnic cu ea — nu de la un tester.

Dacă ai 2 minute: ${url}

Mulțumesc,
Maris
Frizeo.ro`,
  };
}

export async function reviewCandidatesTool(
  args: Record<string, unknown>,
  _ctx: PlatformToolContext,
): Promise<PlatformToolResult> {
  const limit = Math.min(Math.max(asNumber(args.limit) ?? 8, 1), 20);
  const includeDrafts = asBoolean(args.include_drafts, true);

  const loaded = await loadGrowthSnapshot();
  if (loaded.error && loaded.tenants.length === 0) {
    return {
      ok: false,
      summary: "Nu am putut găsi candidați de review.",
      error: loaded.error,
    };
  }

  const reviewed = new Set<string>();
  const { data: testimonials, error: testimonialError } = await supabaseAdmin
    .from("frizeo_marketing_testimonials")
    .select("salon_name, author_name, status")
    .in("status", ["pending", "approved"]);

  if (!testimonialError) {
    for (const row of testimonials ?? []) {
      if (row.salon_name?.trim()) {
        reviewed.add(row.salon_name.trim().toLowerCase());
      }
      if (row.author_name?.trim()) {
        reviewed.add(row.author_name.trim().toLowerCase());
      }
    }
  }

  const ranked = loaded.tenants
    .filter((t) => eligible(t, reviewed))
    .map((t) => {
      const { score, reasons } = scoreCandidate(t);
      return { tenant: t, score, reasons };
    })
    .sort((a, b) => b.score - a.score);

  const top = ranked.slice(0, limit);
  const candidates = top.map(({ tenant, score, reasons }) => {
    const draft = includeDrafts ? buildDraft(tenant) : null;
    return {
      name: tenant.owner_name || tenant.name,
      salon: tenant.name,
      slug: tenant.slug,
      city: tenant.city,
      email: tenant.owner_email,
      phone: tenant.phone,
      plan: tenant.plan_name,
      bookings_last_30d: tenant.bookings_last_30d,
      bookings_ever: tenant.bookings_ever,
      last_login_at: tenant.last_login_at,
      score,
      why: reasons,
      draft,
    };
  });

  const summary = candidates.length
    ? `${candidates.length} candidați de review. Cel mai bun: ${candidates[0].salon} (${candidates[0].why[0] || "activ"}). Draft-urile sunt doar text — nu s-au trimis emailuri.`
    : "Niciun candidat solid (puține programări recente, deja au review, sau probleme de health).";

  return {
    ok: true,
    summary,
    data: {
      review_url: `${getAppUrl()}/review`,
      drafts_are_not_sent: true,
      excluded_existing_reviews: !testimonialError,
      candidates,
    },
  };
}
