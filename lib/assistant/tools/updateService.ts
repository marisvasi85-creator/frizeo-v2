import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AssistantToolContext, AssistantToolResult } from "../types";
import {
  asBoolean,
  asNumber,
  asString,
  resolveBarberFromArgs,
  resolveServiceForBarber,
} from "./helpers";

const ALLOWED_DURATIONS = [15, 30, 45, 60, 75, 90, 120];

function nearestDuration(minutes: number): number {
  return ALLOWED_DURATIONS.reduce((best, current) =>
    Math.abs(current - minutes) < Math.abs(best - minutes) ? current : best,
  );
}

async function loadServiceForEdit(
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
) {
  const serviceId = asString(args.service_id) || asString(args.id);
  if (serviceId) {
    const { data } = await supabaseAdmin
      .from("barber_services")
      .select(
        "id, barber_id, display_name, name, duration, price, show_price, active",
      )
      .eq("id", serviceId)
      .maybeSingle();

    if (!data) {
      return {
        ok: false as const,
        result: {
          ok: false,
          summary: "Serviciul nu a fost găsit.",
          error: "not_found",
        },
      };
    }

    const { data: barber } = await supabaseAdmin
      .from("barbers")
      .select("id")
      .eq("id", data.barber_id)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();

    if (!barber) {
      return {
        ok: false as const,
        result: {
          ok: false,
          summary: "Serviciul nu aparține salonului.",
          error: "forbidden",
        },
      };
    }

    if (ctx.role === "barber" && ctx.barberId !== data.barber_id) {
      return {
        ok: false as const,
        result: {
          ok: false,
          summary: "Nu poți modifica serviciile altui frizer.",
          error: "forbidden",
        },
      };
    }

    return { ok: true as const, barberId: data.barber_id, service: data };
  }

  const target = await resolveBarberFromArgs(ctx, args);
  if (!target.ok) return { ok: false as const, result: target.result };

  const resolved = await resolveServiceForBarber(
    target.barberId,
    ctx.tenantId,
    null,
    asString(args.service_name) || asString(args.name),
    { includeInactive: true },
  );

  if (!resolved.ok) {
    return {
      ok: false as const,
      result: {
        ok: false,
        summary: resolved.summary,
        error: resolved.error,
      },
    };
  }

  const { data } = await supabaseAdmin
    .from("barber_services")
    .select(
      "id, barber_id, display_name, name, duration, price, show_price, active",
    )
    .eq("id", resolved.service.id)
    .maybeSingle();

  if (!data) {
    return {
      ok: false as const,
      result: {
        ok: false,
        summary: "Serviciul nu a fost găsit.",
        error: "not_found",
      },
    };
  }

  return { ok: true as const, barberId: target.barberId, service: data };
}

export async function updateServiceTool(
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const loaded = await loadServiceForEdit(args, ctx);
  if (!loaded.ok) return loaded.result;

  const current = loaded.service;
  const nextName =
    asString(args.display_name) || asString(args.new_name) || current.display_name || current.name;
  const rawDuration = asNumber(args.duration_minutes) ?? asNumber(args.duration);
  const duration =
    rawDuration == null
      ? current.duration
      : ALLOWED_DURATIONS.includes(rawDuration)
        ? rawDuration
        : nearestDuration(rawDuration);

  const hasPriceArg =
    args.price_ron !== undefined ||
    args.price !== undefined ||
    args.clear_price === true;
  const clearPrice = args.clear_price === true;
  const price = clearPrice
    ? null
    : hasPriceArg
      ? (asNumber(args.price_ron) ?? asNumber(args.price))
      : current.price;
  const showPrice = price != null && args.show_price !== false;
  const active =
    args.active === undefined ? Boolean(current.active) : asBoolean(args.active);

  const confirmed = asBoolean(args.confirmed);
  const proposal = {
    service_id: current.id,
    name: nextName,
    duration_minutes: duration,
    price_ron: price,
    show_price: showPrice,
    active,
  };

  if (!confirmed) {
    return {
      ok: true,
      summary: `Confirmare necesară: actualizez „${current.display_name || current.name}” → ${nextName}, ${duration} min${
        price == null ? ", fără preț" : `, ${price} lei`
      }${active ? "" : ", inactiv"}.`,
      data: {
        needs_confirmation: true,
        action: "update_service",
        proposal,
        instruct_user:
          "Prezintă propunerea. Utilizatorul confirmă din butoane (nu seta confirmed=true).",
      },
    };
  }

  const { data, error } = await supabaseAdmin
    .from("barber_services")
    .update({
      name: nextName,
      display_name: nextName,
      duration,
      price: price ?? null,
      show_price: showPrice,
      active,
    })
    .eq("id", current.id)
    .select("id, display_name, name, duration, price, show_price, active")
    .single();

  if (error || !data) {
    return {
      ok: false,
      summary: "Nu am putut actualiza serviciul.",
      error: error?.message || "update_failed",
    };
  }

  return {
    ok: true,
    summary: `Serviciu actualizat: ${data.display_name || data.name}, ${data.duration} min${
      data.active ? "" : " (inactiv)"
    }.`,
    data: {
      service: {
        id: data.id,
        name: data.display_name || data.name,
        duration_minutes: data.duration,
        price_ron: data.show_price ? data.price : null,
        active: data.active,
      },
    },
  };
}

export async function deactivateServiceTool(
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const loaded = await loadServiceForEdit(args, ctx);
  if (!loaded.ok) return loaded.result;

  const current = loaded.service;
  if (!current.active && args.active !== true) {
    return {
      ok: true,
      summary: `„${current.display_name || current.name}” e deja inactiv.`,
      data: { service_id: current.id, active: false },
    };
  }

  const activate = args.active === true;
  const confirmed = asBoolean(args.confirmed);
  const label = current.display_name || current.name;
  const action = activate ? "reactivez" : "dezactivez";

  if (!confirmed) {
    return {
      ok: true,
      summary: `Confirmare necesară: ${action} serviciul „${label}”. ${
        activate
          ? "Va reapare la programări."
          : "Dispare de pe pagina publică; programările vechi rămân."
      }`,
      data: {
        needs_confirmation: true,
        action: "deactivate_service",
        proposal: {
          service_id: current.id,
          name: label,
          active: activate,
        },
        instruct_user:
          "Prezintă propunerea. Utilizatorul confirmă din butoane (nu seta confirmed=true).",
      },
    };
  }

  const { data, error } = await supabaseAdmin
    .from("barber_services")
    .update({ active: activate })
    .eq("id", current.id)
    .select("id, display_name, name, active")
    .single();

  if (error || !data) {
    return {
      ok: false,
      summary: "Nu am putut actualiza serviciul.",
      error: error?.message || "update_failed",
    };
  }

  return {
    ok: true,
    summary: activate
      ? `Serviciul „${data.display_name || data.name}” e din nou activ.`
      : `Serviciul „${data.display_name || data.name}” e dezactivat (nu mai apare la programări).`,
    data: { service_id: data.id, active: data.active },
  };
}
