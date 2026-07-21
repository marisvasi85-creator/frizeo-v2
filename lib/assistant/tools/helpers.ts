import { barberBelongsToTenant } from "@/lib/auth/requireTenantAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AssistantToolContext } from "../types";

export async function resolveTargetBarberId(
  ctx: AssistantToolContext,
  barberIdArg: string | null,
): Promise<{ barberId: string | null; error?: string }> {
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

  if (ctx.barberId) {
    return { barberId: ctx.barberId };
  }

  const { data } = await supabaseAdmin
    .from("barbers")
    .select("id")
    .eq("tenant_id", ctx.tenantId)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (!data) {
    return { barberId: null, error: "Nu există frizer activ în salon." };
  }

  return { barberId: data.id };
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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

    // Ensure the barber (and thus the service) belongs to this tenant.
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

    if (!data.active) {
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
  const { data: services } = await supabaseAdmin
    .from("barber_services")
    .select("id, display_name, name, duration, barber_id, active")
    .eq("barber_id", barberId)
    .eq("active", true);

  const matches = (services ?? []).filter((s) => {
    const label = `${s.display_name || ""} ${s.name || ""}`.toLowerCase();
    return label.includes(needle) || needle.includes((s.display_name || s.name || "").toLowerCase());
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
