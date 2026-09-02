import type { PlatformToolContext, PlatformToolResult } from "../types";
import { loadGrowthSnapshot } from "../growth/snapshot";
import type { GrowthTenant } from "../growth/types";

type Stage = {
  key: string;
  label: string;
  count: number;
  pct_of_signup: number;
  drop_from_prev: number | null;
  drop_pct: number | null;
};

function pass(tenants: GrowthTenant[], pred: (t: GrowthTenant) => boolean) {
  return tenants.filter(pred).length;
}

export async function growthFunnelTool(
  _args: Record<string, unknown>,
  _ctx: PlatformToolContext,
): Promise<PlatformToolResult> {
  const loaded = await loadGrowthSnapshot();
  if (loaded.error && loaded.tenants.length === 0) {
    return {
      ok: false,
      summary: "Nu am putut calcula funnel-ul.",
      error: loaded.error,
    };
  }

  const all = loaded.tenants;
  const signup = all.length;
  if (signup === 0) {
    return {
      ok: true,
      summary: "Nu există saloane — funnel gol.",
      data: { stages: [], biggest_drop: null },
    };
  }

  const trialNow = pass(all, (t) => t.is_trialing);
  const counts = [
    { key: "signup", label: "Signup", n: signup },
    {
      key: "onboarding",
      label: "Onboarding (login real)",
      n: pass(all, (t) => Boolean(t.last_login_at)),
    },
    {
      key: "services",
      label: "Servicii adăugate",
      n: pass(all, (t) => t.has_services),
    },
    {
      key: "schedule",
      label: "Program configurat",
      n: pass(all, (t) => t.has_working_schedule),
    },
    {
      key: "first_booking",
      label: "Prima programare",
      n: pass(all, (t) => t.bookings_ever > 0),
    },
    {
      key: "trial_or_paid",
      label: "Trial activ sau Pro",
      n: pass(all, (t) => t.is_trialing || t.is_paid),
    },
    {
      key: "pro",
      label: "Pro (plătit / complimentary)",
      n: pass(all, (t) => t.is_paid),
    },
  ];

  const stages: Stage[] = counts.map((stage, i) => {
    const prev = i === 0 ? null : counts[i - 1].n;
    const drop = prev === null ? null : Math.max(prev - stage.n, 0);
    const dropPct =
      prev && prev > 0 && drop !== null
        ? Math.round((drop / prev) * 100)
        : null;
    return {
      key: stage.key,
      label: stage.label,
      count: stage.n,
      pct_of_signup: Math.round((stage.n / signup) * 100),
      drop_from_prev: drop,
      drop_pct: dropPct,
    };
  });

  // Biggest drop among sequential stages except signup. Trial activ → Pro is
  // expected to be large; still report it, plus the next-biggest operational drop.
  let biggest = stages[1];
  for (const stage of stages.slice(1)) {
    if ((stage.drop_from_prev ?? 0) > (biggest.drop_from_prev ?? 0)) {
      biggest = stage;
    }
  }

  const biggestIndex = stages.findIndex((s) => s.key === biggest.key);
  const fromStage = stages[Math.max(biggestIndex - 1, 0)];

  const firstBooking = stages.find((s) => s.key === "first_booking");
  const schedule = stages.find((s) => s.key === "schedule");
  const recommendations: string[] = [];

  if (biggest.key === "first_booking") {
    recommendations.push(
      `Abandonul mare e între program configurat și prima programare (${biggest.drop_from_prev} saloane). Ajută-i să-și publice link-ul de booking.`,
    );
  } else if (biggest.key === "pro") {
    recommendations.push(
      `Cel mai mare salt e trial/activ → Pro (${biggest.drop_from_prev} pierduți). Conversia se lucrează pe trial-urile cu programări, nu pe conturile goale.`,
    );
  } else if (biggest.key === "trial_or_paid") {
    recommendations.push(
      `${biggest.drop_from_prev} saloane cu programări nu sunt nici în trial, nici pe Pro (expired/canceled/free). Win-back sau cleanup.`,
    );
  } else if (biggest.key === "onboarding") {
    recommendations.push(
      `${biggest.drop_from_prev} conturi nu s-au mai autentificat după signup. Follow-up de activare în 24h.`,
    );
  } else {
    recommendations.push(
      `Cea mai mare cădere: ${fromStage.label} → ${biggest.label} (${biggest.drop_from_prev} saloane, ${biggest.drop_pct}%).`,
    );
  }

  if (
    schedule &&
    firstBooking &&
    schedule.count > 0 &&
    firstBooking.count / schedule.count < 0.5
  ) {
    recommendations.push(
      `Doar ${firstBooking.pct_of_signup}% din signup-uri au o programare. Ăsta e palierul de produs, nu de billing.`,
    );
  }

  recommendations.push(
    "Notă: la signup, Frizeo pune servicii și program default — etapele „servicii” și „program” sunt aproape egale cu signup. Semnalul real e login + prima programare + Pro.",
  );

  const summary = [
    `Funnel: ${signup} signup → ${firstBooking?.count ?? 0} cu programare (${firstBooking?.pct_of_signup ?? 0}%) → ${
      stages.find((s) => s.key === "pro")?.count ?? 0
    } Pro.`,
    `Cea mai mare cădere: ${fromStage.label} → ${biggest.label} (${biggest.drop_pct}% drop).`,
    recommendations[0],
  ].join(" ");

  return {
    ok: true,
    summary,
    data: {
      total_signups: signup,
      trial_active_now: trialNow,
      stages,
      biggest_drop: {
        from: fromStage.key,
        to: biggest.key,
        from_label: fromStage.label,
        to_label: biggest.label,
        lost: biggest.drop_from_prev,
        drop_pct: biggest.drop_pct,
      },
      recommendations,
    },
  };
}
