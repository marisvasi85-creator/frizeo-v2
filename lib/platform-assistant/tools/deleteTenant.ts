import { isPlatformCreatorEmail } from "@/lib/auth/requirePlatformCreator";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PlatformToolContext, PlatformToolResult } from "../types";
import { asBoolean, asString, resolveTenant } from "./helpers";

async function countExact(
  table: string,
  column: string,
  value: string,
): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, value);
  if (error) return 0;
  return count ?? 0;
}

async function deleteBy(
  table: string,
  column: string,
  value: string,
): Promise<string | null> {
  const { error } = await supabaseAdmin.from(table).delete().eq(column, value);
  if (error) {
    // Table may not exist in some envs — treat missing relation as soft skip
    if (/does not exist|schema cache/i.test(error.message)) return null;
    return `${table}: ${error.message}`;
  }
  return null;
}

async function emptyStorageFolder(
  bucket: string,
  folder: string,
): Promise<void> {
  try {
    const { data } = await supabaseAdmin.storage.from(bucket).list(folder, {
      limit: 100,
    });
    if (!data?.length) return;
    const paths = data
      .filter((f) => f.name)
      .map((f) => `${folder}/${f.name}`);
    if (paths.length) {
      await supabaseAdmin.storage.from(bucket).remove(paths);
    }
  } catch (err) {
    console.warn("platform delete_tenant storage", bucket, folder, err);
  }
}

/**
 * Creator-only: permanently delete a tenant + related data + orphan Auth users.
 * Confirmation + matching confirm_slug required.
 */
export async function deleteTenantTool(
  args: Record<string, unknown>,
  ctx: PlatformToolContext,
): Promise<PlatformToolResult> {
  const confirmed = asBoolean(args.confirmed);
  const cancelStripe = asBoolean(args.cancel_stripe, true);
  const deleteAuthUsers = asBoolean(args.delete_auth_users, true);

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

  const tenant = resolved.tenant;

  const [
    bookingsCount,
    barbersRes,
    tenantUsersRes,
    subRes,
    servicesCount,
  ] = await Promise.all([
    countExact("bookings", "tenant_id", tenant.id),
    supabaseAdmin
      .from("barbers")
      .select("id, user_id, display_name")
      .eq("tenant_id", tenant.id),
    supabaseAdmin
      .from("tenant_users")
      .select("user_id, role")
      .eq("tenant_id", tenant.id),
    supabaseAdmin
      .from("subscriptions")
      .select("status, stripe_subscription_id, stripe_customer_id, plans(name, slug)")
      .eq("tenant_id", tenant.id)
      .maybeSingle(),
    countExact("barber_services", "tenant_id", tenant.id),
  ]);

  const barbers = barbersRes.data ?? [];
  const tenantUsers = tenantUsersRes.data ?? [];
  const sub = subRes.data;
  const plan = sub?.plans as { name?: string; slug?: string } | null;

  const memberEmails: Array<{ user_id: string; role: string; email: string | null }> =
    [];
  for (const row of tenantUsers) {
    let email: string | null = null;
    try {
      const { data } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
      email = data.user?.email ?? null;
    } catch {
      // ignore
    }
    memberEmails.push({ user_id: row.user_id, role: row.role, email });
  }

  const proposal = {
    tenant_id: tenant.id,
    tenant_name: tenant.name,
    slug: tenant.slug,
    counts: {
      bookings: bookingsCount,
      barbers: barbers.length,
      services: servicesCount,
      members: tenantUsers.length,
    },
    subscription: {
      status: sub?.status || null,
      plan_name: plan?.name || null,
      stripe_subscription_id: sub?.stripe_subscription_id || null,
      stripe_customer_id: sub?.stripe_customer_id || null,
    },
    members: memberEmails,
    options: {
      cancel_stripe: cancelStripe,
      delete_auth_users: deleteAuthUsers,
    },
    warning:
      "Ștergere PERMANENTĂ: programări, frizeri, abonament Frizeo, storage, și (opțional) conturi Auth fără alte saloane. Nu se poate anula.",
  };

  if (!confirmed) {
    return {
      ok: true,
      summary: `Confirmare necesară: șterg definitiv salonul „${tenant.name}” (${tenant.slug}) — ${bookingsCount} programări, ${barbers.length} frizeri, ${tenantUsers.length} membri.`,
      data: {
        needs_confirmation: true,
        action: "delete_tenant",
        proposal,
        instruct_user: `Cere confirmare explicită. Dacă acceptă, apelează delete_tenant cu confirmed=true și confirm_slug="${tenant.slug}".`,
      },
    };
  }

  const confirmSlug = asString(args.confirm_slug)?.toLowerCase();
  if (!confirmSlug || confirmSlug !== tenant.slug.toLowerCase()) {
    return {
      ok: false,
      summary: `Pentru ștergere, confirm_slug trebuie să fie exact „${tenant.slug}”.`,
      error: "confirm_slug_mismatch",
      data: { expected_slug: tenant.slug },
    };
  }

  const warnings: string[] = [];

  // 1) Stripe cancel
  if (cancelStripe && sub?.stripe_subscription_id) {
    try {
      await getStripe().subscriptions.cancel(sub.stripe_subscription_id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "stripe cancel failed";
      // already canceled is fine
      if (!/No such subscription|already been canceled|resource_missing/i.test(msg)) {
        warnings.push(`Stripe cancel: ${msg}`);
      }
    }
  }

  // 2) Storage
  await emptyStorageFolder("salon-logos", tenant.id);
  await emptyStorageFolder("salon-gallery", tenant.id);
  for (const b of barbers) {
    await emptyStorageFolder("barber-avatars", b.id);
  }

  // 3) DB children
  const barberIds = barbers.map((b) => b.id);
  const deleteErrors: string[] = [];

  // Bookings first (may FK to barbers/services)
  for (const table of [
    "bookings",
    "salon_gallery",
    "notification_settings",
    "barber_invitations",
    "platform_tenant_notes",
    "marketing_ai_generations",
    "tenant_fiscal_invoices",
  ] as const) {
    const err = await deleteBy(table, "tenant_id", tenant.id);
    if (err) deleteErrors.push(err);
  }

  // slug_redirects by tenant_id and by entity
  {
    const err1 = await deleteBy("slug_redirects", "tenant_id", tenant.id);
    if (err1) deleteErrors.push(err1);
    const { error } = await supabaseAdmin
      .from("slug_redirects")
      .delete()
      .eq("entity_type", "tenant")
      .eq("entity_id", tenant.id);
    if (error && !/does not exist|schema cache/i.test(error.message)) {
      deleteErrors.push(`slug_redirects entity: ${error.message}`);
    }
  }

  for (const barberId of barberIds) {
    for (const table of [
      "barber_weekly_schedule",
      "barber_day_overrides",
      "barber_settings",
      "barber_services",
      "barber_google_accounts",
    ] as const) {
      const err = await deleteBy(table, "barber_id", barberId);
      if (err) deleteErrors.push(err);
    }
  }

  // Remaining tenant-scoped services (if any without barber cascade)
  {
    const err = await deleteBy("barber_services", "tenant_id", tenant.id);
    if (err) deleteErrors.push(err);
  }

  for (const table of ["subscriptions", "tenant_users", "user_active_tenant"] as const) {
    const err = await deleteBy(table, "tenant_id", tenant.id);
    if (err) deleteErrors.push(err);
  }

  {
    const err = await deleteBy("barbers", "tenant_id", tenant.id);
    if (err) deleteErrors.push(err);
  }

  {
    const { error } = await supabaseAdmin
      .from("tenants")
      .delete()
      .eq("id", tenant.id);
    if (error) {
      return {
        ok: false,
        summary: `Nu am putut șterge tenant-ul: ${error.message}`,
        error: error.message,
        data: { delete_errors: deleteErrors, warnings },
      };
    }
  }

  // 4) Auth users (only if no other tenant membership)
  const authDeleted: string[] = [];
  const authSkipped: string[] = [];

  if (deleteAuthUsers) {
    const uniqueUserIds = [...new Set(tenantUsers.map((u) => u.user_id))];
    for (const userId of uniqueUserIds) {
      const member = memberEmails.find((m) => m.user_id === userId);
      if (member?.email && isPlatformCreatorEmail(member.email)) {
        authSkipped.push(`${member.email} (creator Frizeo)`);
        continue;
      }

      const { count } = await supabaseAdmin
        .from("tenant_users")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      if ((count ?? 0) > 0) {
        authSkipped.push(
          `${member?.email || userId} (încă membru în alt salon)`,
        );
        continue;
      }

      // Clear active tenant pointer if any leftover
      await supabaseAdmin
        .from("user_active_tenant")
        .delete()
        .eq("user_id", userId);

      await supabaseAdmin.from("profiles").delete().eq("id", userId);

      const { error: authErr } =
        await supabaseAdmin.auth.admin.deleteUser(userId);
      if (authErr) {
        warnings.push(`Auth delete ${member?.email || userId}: ${authErr.message}`);
      } else {
        authDeleted.push(member?.email || userId);
      }
    }
  }

  console.info("platform delete_tenant", {
    by: ctx.email,
    userId: ctx.userId,
    tenantId: tenant.id,
    tenantName: tenant.name,
    slug: tenant.slug,
    authDeleted,
    authSkipped,
    warnings,
    deleteErrors,
    at: new Date().toISOString(),
  });

  return {
    ok: deleteErrors.length === 0,
    summary: `Șters: „${tenant.name}” (${tenant.slug}). ${
      authDeleted.length
        ? `Auth șters: ${authDeleted.join(", ")}.`
        : "Niciun user Auth șters."
    }${authSkipped.length ? ` Auth păstrat: ${authSkipped.join("; ")}.` : ""}${
      warnings.length ? ` Atenții: ${warnings.join("; ")}.` : ""
    }${
      deleteErrors.length
        ? ` Erori parțiale pe tabele: ${deleteErrors.slice(0, 3).join("; ")}.`
        : ""
    }`,
    data: {
      deleted_tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      auth_deleted: authDeleted,
      auth_skipped: authSkipped,
      warnings,
      delete_errors: deleteErrors,
    },
    error: deleteErrors.length ? "partial_db_cleanup" : undefined,
  };
}