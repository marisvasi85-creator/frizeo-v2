import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AssistantToolContext, AssistantToolResult } from "../types";

export async function listBarbersTool(
  _args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const { data, error } = await supabaseAdmin
    .from("barbers")
    .select("id, display_name, active, slug")
    .eq("tenant_id", ctx.tenantId)
    .order("display_name", { ascending: true });

  if (error) {
    return {
      ok: false,
      summary: "Nu am putut lista frizerii.",
      error: error.message,
    };
  }

  const barbers = (data ?? []).map((row) => ({
    id: row.id as string,
    name: (row.display_name as string | null) || "Frizer",
    active: Boolean(row.active),
    slug: (row.slug as string | null) || null,
    is_current: ctx.barberId === row.id,
  }));

  const active = barbers.filter((b) => b.active);
  const summary =
    active.length === 0
      ? "Nu există frizeri activi în salon."
      : `Frizeri activi (${active.length}): ${active
          .map((b) => `${b.name}${b.is_current ? " (tu)" : ""}`)
          .join(", ")}.`;

  return {
    ok: true,
    summary,
    data: {
      barbers,
      active_count: active.length,
      total_count: barbers.length,
    },
  };
}
