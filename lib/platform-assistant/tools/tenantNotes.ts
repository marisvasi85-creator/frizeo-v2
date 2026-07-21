import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PlatformToolContext, PlatformToolResult } from "../types";
import { asNumber, asString, resolveTenant } from "./helpers";

const NOTES_TABLE = "platform_tenant_notes";

function migrationHint(message: string): boolean {
  return /platform_tenant_notes|relation .* does not exist|schema cache/i.test(
    message,
  );
}

/**
 * List creator internal notes for a tenant.
 */
export async function listTenantNotesTool(
  args: Record<string, unknown>,
  _ctx: PlatformToolContext,
): Promise<PlatformToolResult> {
  const limit = Math.min(Math.max(asNumber(args.limit) ?? 20, 1), 50);
  const resolved = await resolveTenant(args);

  if (resolved.ambiguous) {
    return {
      ok: false,
      summary: "Mai multe saloane potrivesc. Specifică slug sau tenant_id.",
      error: "ambiguous",
      data: { candidates: resolved.ambiguous },
    };
  }
  if (!resolved.tenant) {
    return {
      ok: false,
      summary: "Salonul nu a fost găsit. Specifică name, slug sau tenant_id.",
      error: "not_found",
    };
  }

  const { data, error } = await supabaseAdmin
    .from(NOTES_TABLE)
    .select("id, body, author_email, created_at")
    .eq("tenant_id", resolved.tenant.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return {
      ok: false,
      summary: migrationHint(error.message)
        ? "Tabela platform_tenant_notes lipsește — rulează migrarea în Supabase (staging)."
        : "Nu am putut încărca notele.",
      error: error.message,
    };
  }

  const notes = data ?? [];
  return {
    ok: true,
    summary: notes.length
      ? `${notes.length} notă/note interne pentru „${resolved.tenant.name}”.`
      : `Nicio notă internă pentru „${resolved.tenant.name}”.`,
    data: {
      tenant: {
        id: resolved.tenant.id,
        name: resolved.tenant.name,
        slug: resolved.tenant.slug,
      },
      notes,
    },
  };
}

/**
 * Add an internal creator note on a tenant (no Stripe / billing side effects).
 */
export async function addTenantNoteTool(
  args: Record<string, unknown>,
  ctx: PlatformToolContext,
): Promise<PlatformToolResult> {
  const body = asString(args.body) || asString(args.note) || asString(args.text);
  if (!body) {
    return {
      ok: false,
      summary: "Lipsește textul notei (body).",
      error: "missing_body",
    };
  }
  if (body.length > 4000) {
    return {
      ok: false,
      summary: "Nota e prea lungă (max 4000 caractere).",
      error: "too_long",
    };
  }

  const resolved = await resolveTenant(args);
  if (resolved.ambiguous) {
    return {
      ok: false,
      summary: "Mai multe saloane potrivesc. Specifică slug sau tenant_id.",
      error: "ambiguous",
      data: { candidates: resolved.ambiguous },
    };
  }
  if (!resolved.tenant) {
    return {
      ok: false,
      summary: "Salonul nu a fost găsit.",
      error: "not_found",
    };
  }

  const { data, error } = await supabaseAdmin
    .from(NOTES_TABLE)
    .insert({
      tenant_id: resolved.tenant.id,
      author_user_id: ctx.userId,
      author_email: ctx.email,
      body,
    })
    .select("id, body, author_email, created_at")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      summary: migrationHint(error.message)
        ? "Tabela platform_tenant_notes lipsește — rulează migrarea în Supabase (staging)."
        : "Nu am putut salva nota.",
      error: error.message,
    };
  }

  console.info("platform add_tenant_note", {
    by: ctx.email,
    userId: ctx.userId,
    tenantId: resolved.tenant.id,
    noteId: data?.id,
    at: new Date().toISOString(),
  });

  return {
    ok: true,
    summary: `Notă salvată pe „${resolved.tenant.name}”.`,
    data: {
      tenant: {
        id: resolved.tenant.id,
        name: resolved.tenant.name,
        slug: resolved.tenant.slug,
      },
      note: data,
    },
  };
}
