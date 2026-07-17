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
