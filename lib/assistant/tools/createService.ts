import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AssistantToolContext, AssistantToolResult } from "../types";

const ALLOWED_DURATIONS = [15, 30, 45, 60, 75, 90, 120];

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function nearestDuration(minutes: number): number {
  return ALLOWED_DURATIONS.reduce((best, current) =>
    Math.abs(current - minutes) < Math.abs(best - minutes) ? current : best,
  );
}

export async function createServiceTool(
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const name = asString(args.name) || asString(args.display_name);
  const rawDuration = asNumber(args.duration_minutes) ?? asNumber(args.duration);
  const price = asNumber(args.price_ron) ?? asNumber(args.price);
  const confirmed = asBoolean(args.confirmed);
  const barberIdArg = asString(args.barber_id);

  if (!name) {
    return {
      ok: false,
      summary: "Lipsa denumirea serviciului.",
      error: "missing_name",
    };
  }

  if (rawDuration == null) {
    return {
      ok: false,
      summary: "Lipsa durata în minute.",
      error: "missing_duration",
    };
  }

  const duration = ALLOWED_DURATIONS.includes(rawDuration)
    ? rawDuration
    : nearestDuration(rawDuration);

  let barberId = ctx.barberId;
  if (ctx.role === "barber") {
    if (!barberId) {
      return {
        ok: false,
        summary: "Nu am găsit profilul de frizer.",
        error: "missing_barber",
      };
    }
  } else if (barberIdArg) {
    const { data } = await supabaseAdmin
      .from("barbers")
      .select("id, display_name")
      .eq("id", barberIdArg)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();
    if (!data) {
      return {
        ok: false,
        summary: "Frizerul nu aparține salonului.",
        error: "invalid_barber",
      };
    }
    barberId = data.id;
  } else if (!barberId) {
    const { data } = await supabaseAdmin
      .from("barbers")
      .select("id")
      .eq("tenant_id", ctx.tenantId)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    barberId = data?.id ?? null;
  }

  if (!barberId) {
    return {
      ok: false,
      summary: "Nu am un frizer pentru care să adaug serviciul.",
      error: "missing_barber",
    };
  }

  const proposal = {
    barber_id: barberId,
    name,
    display_name: name,
    duration_minutes: duration,
    price_ron: price,
    price_note:
      price == null
        ? "Preț nesetat (opțional)"
        : `Preț: ${price} lei`,
  };

  if (!confirmed) {
    return {
      ok: true,
      summary: `Confirmare necesară: adaug serviciul „${name}”, ${duration} min${
        price == null ? ", fără preț" : `, ${price} lei`
      }.`,
      data: {
        needs_confirmation: true,
        action: "create_service",
        proposal,
        instruct_user:
          "Cere utilizatorului să confirme. Dacă spune da, apelează din nou create_service cu aceleași argumente și confirmed=true.",
      },
    };
  }

  const { data, error } = await supabaseAdmin
    .from("barber_services")
    .insert({
      barber_id: barberId,
      tenant_id: ctx.tenantId,
      name,
      display_name: name,
      duration,
      price: price ?? null,
      show_price: price != null,
      featured: false,
      active: true,
    })
    .select("id, display_name, name, duration, price, show_price, active")
    .single();

  if (error) {
    return {
      ok: false,
      summary: "Nu am putut adăuga serviciul.",
      error: error.message,
    };
  }

  return {
    ok: true,
    summary: `Serviciu creat: ${data.display_name || data.name}, ${data.duration} min.`,
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
