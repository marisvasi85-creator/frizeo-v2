import { barberBelongsToTenant } from "@/lib/auth/requireTenantAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AssistantToolContext } from "../types";

export type BarberCandidate = {
  id: string;
  name: string;
};

export async function listActiveBarbersForTenant(
  tenantId: string,
): Promise<BarberCandidate[]> {
  const { data } = await supabaseAdmin
    .from("barbers")
    .select("id, display_name")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .order("display_name", { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: (row.display_name as string | null) || "Frizer",
  }));
}

/**
 * Resolve which barber an owner/manager/barber action targets.
 * - Barber role: always self
 * - Explicit barber_id / barber_name: preferred
 * - Owner with active own barber profile: self
 * - Admin-only owner (no active self): never auto-self; single active or needsChoice
 * - Single active barber: that one
 * - Multiple active barbers without choice: needsChoice
 */
export async function resolveTargetBarberId(
  ctx: AssistantToolContext,
  barberIdArg: string | null,
  barberNameArg?: string | null,
): Promise<{
  barberId: string | null;
  error?: string;
  needsChoice?: boolean;
  candidates?: BarberCandidate[];
}> {
  if (ctx.role === "barber") {
    if (!ctx.barberId) {
      return { barberId: null, error: "Nu am găsit profilul de frizer." };
    }
    return { barberId: ctx.barberId };
  }

  if (barberIdArg) {
    const ok = await barberBelongsToTenant(
      supabaseAdmin,
      barberIdArg,
      ctx.tenantId,
    );
    if (!ok) {
      return { barberId: null, error: "Frizerul nu aparține salonului." };
    }
    return { barberId: barberIdArg };
  }

  const candidates = await listActiveBarbersForTenant(ctx.tenantId);

  if (barberNameArg?.trim()) {
    const needle = barberNameArg.trim().toLowerCase();
    const matches = candidates.filter(
      (b) =>
        b.name.toLowerCase().includes(needle) ||
        needle.includes(b.name.toLowerCase()),
    );

    if (matches.length === 1) {
      return { barberId: matches[0].id };
    }

    if (matches.length === 0) {
      return {
        barberId: null,
        error: `Nu am găsit frizerul „${barberNameArg}". Folosește list_barbers.`,
        candidates,
        needsChoice: candidates.length > 1,
      };
    }

    return {
      barberId: null,
      error: `Mai mulți frizeri potrivesc „${barberNameArg}": ${matches
        .map((b) => b.name)
        .join(", ")}. Specifică barber_id.`,
      candidates: matches,
      needsChoice: true,
    };
  }

  if (ctx.barberId) {
    const selfActive = candidates.some((b) => b.id === ctx.barberId);
    if (selfActive) {
      return { barberId: ctx.barberId };
    }
  }

  if (candidates.length === 1) {
    return { barberId: candidates[0].id };
  }

  if (candidates.length === 0) {
    return { barberId: null, error: "Nu există frizer activ în salon." };
  }

  return {
    barberId: null,
    error:
      "Salonul are mai mulți frizeri. Specifică barber_id sau barber_name (folosește list_barbers).",
    needsChoice: true,
    candidates,
  };
}

export function barberChoiceResult(resolved: {
  error?: string;
  candidates?: BarberCandidate[];
  needsChoice?: boolean;
}) {
  return {
    ok: false as const,
    summary: resolved.error || "Alege frizerul.",
    error: resolved.needsChoice ? "needs_barber_choice" : "missing_barber",
    data: resolved.candidates
      ? {
          needs_barber_choice: true,
          candidates: resolved.candidates,
          instruct_user:
            "Prezintă lista de frizeri și cere utilizatorului să aleagă. Apoi reia tool-ul cu barber_id sau barber_name.",
        }
      : undefined,
  };
}

export async function resolveBarberFromArgs(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
): Promise<
  | { ok: true; barberId: string }
  | { ok: false; result: ReturnType<typeof barberChoiceResult> }
> {
  const resolved = await resolveTargetBarberId(
    ctx,
    asString(args.barber_id),
    asString(args.barber_name) || asString(args.barber),
  );

  if (!resolved.barberId) {
    return { ok: false, result: barberChoiceResult(resolved) };
  }

  return { ok: true, barberId: resolved.barberId };
}

/**
 * Optional barber filter for list tools.
 * - No barber_id/name → all active barbers (or self for barber role)
 * - Explicit choice → that barber (or needsChoice / error)
 */
export async function resolveOptionalBarberFilter(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
): Promise<
  | { ok: true; barberIds: string[] }
  | { ok: false; result: ReturnType<typeof barberChoiceResult> }
> {
  if (ctx.role === "barber") {
    if (!ctx.barberId) {
      return {
        ok: false,
        result: {
          ok: false,
          summary: "Nu am găsit profilul de frizer.",
          error: "missing_barber",
          data: undefined,
        },
      };
    }
    return { ok: true, barberIds: [ctx.barberId] };
  }

  const barberIdArg = asString(args.barber_id);
  const barberNameArg =
    asString(args.barber_name) || asString(args.barber);

  if (!barberIdArg && !barberNameArg) {
    const candidates = await listActiveBarbersForTenant(ctx.tenantId);
    return { ok: true, barberIds: candidates.map((b) => b.id) };
  }

  const resolved = await resolveTargetBarberId(
    ctx,
    barberIdArg,
    barberNameArg,
  );

  if (!resolved.barberId) {
    return { ok: false, result: barberChoiceResult(resolved) };
  }

  return { ok: true, barberIds: [resolved.barberId] };
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Phone variants stored in bookings: 07… / +40… / 40… */
export function phoneVariants(raw: string): string[] {
  const compact = raw.replace(/[\s.-]/g, "");
  const out = new Set<string>([compact]);
  if (compact.startsWith("+40") && compact.length === 12) {
    out.add(`0${compact.slice(3)}`);
    out.add(`40${compact.slice(3)}`);
  } else if (compact.startsWith("40") && compact.length === 11) {
    out.add(`0${compact.slice(2)}`);
    out.add(`+${compact}`);
  } else if (compact.startsWith("0") && compact.length === 10) {
    out.add(`+40${compact.slice(1)}`);
    out.add(`40${compact.slice(1)}`);
  }
  return [...out];
}

export function asBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

export function asNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeTime(value: string): string {
  const trimmed = value.trim();
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [h, m] = trimmed.split(":");
    return `${h.padStart(2, "0")}:${m}`;
  }
  return trimmed.slice(0, 5);
}

export function isValidRoPhone(phone: string): boolean {
  return /^(\+40|0)[0-9]{9}$/.test(phone.replace(/\s/g, ""));
}

export async function resolveServiceForBarber(
  barberId: string,
  tenantId: string,
  serviceIdArg: string | null,
  serviceNameArg: string | null,
  options?: { includeInactive?: boolean },
): Promise<
  | {
      ok: true;
      service: {
        id: string;
        display_name: string | null;
        name: string | null;
        duration: number;
        barber_id: string;
      };
    }
  | { ok: false; error: string; summary: string }
> {
  if (serviceIdArg) {
    const { data } = await supabaseAdmin
      .from("barber_services")
      .select("id, display_name, name, duration, barber_id, active")
      .eq("id", serviceIdArg)
      .maybeSingle();

    if (!data || data.barber_id !== barberId) {
      return {
        ok: false,
        error: "invalid_service",
        summary: "Serviciul nu aparține frizerului selectat.",
      };
    }

    const { data: barber } = await supabaseAdmin
      .from("barbers")
      .select("id")
      .eq("id", barberId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!barber) {
      return {
        ok: false,
        error: "invalid_service",
        summary: "Serviciul nu aparține salonului.",
      };
    }

    if (!data.active && !options?.includeInactive) {
      return {
        ok: false,
        error: "inactive_service",
        summary: "Serviciul este inactiv.",
      };
    }

    return { ok: true, service: data };
  }

  if (!serviceNameArg) {
    return {
      ok: false,
      error: "missing_service",
      summary:
        "Specifică service_id sau service_name. Folosește list_services dacă e nevoie.",
    };
  }

  const needle = serviceNameArg.toLowerCase();
  let servicesQuery = supabaseAdmin
    .from("barber_services")
    .select("id, display_name, name, duration, barber_id, active")
    .eq("barber_id", barberId);

  if (!options?.includeInactive) {
    servicesQuery = servicesQuery.eq("active", true);
  }

  const { data: services } = await servicesQuery;

  const matches = (services ?? []).filter((s) => {
    const label = `${s.display_name || ""} ${s.name || ""}`.toLowerCase();
    return (
      label.includes(needle) ||
      needle.includes((s.display_name || s.name || "").toLowerCase())
    );
  });

  if (matches.length === 0) {
    return {
      ok: false,
      error: "service_not_found",
      summary: `Nu am găsit serviciul „${serviceNameArg}". Folosește list_services.`,
    };
  }

  if (matches.length > 1) {
    const exact = matches.find(
      (s) =>
        (s.display_name || "").toLowerCase() === needle ||
        (s.name || "").toLowerCase() === needle,
    );
    if (!exact) {
      return {
        ok: false,
        error: "ambiguous_service",
        summary: `Mai multe servicii potrivesc „${serviceNameArg}": ${matches
          .slice(0, 5)
          .map((s) => s.display_name || s.name)
          .join(", ")}.`,
      };
    }
    return { ok: true, service: exact };
  }

  return { ok: true, service: matches[0] };
}
