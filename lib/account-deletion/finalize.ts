import { ANONYMIZED_BARBER_DISPLAY_NAME } from "@/lib/account-deletion/constants";
import {
  buildFinalizationPlan,
  type BarberSnapshot,
  type TenantMembershipSnapshot,
} from "@/lib/account-deletion/decisions";
import { sendAccountDeletionCompletedEmail } from "@/lib/account-deletion/emails";
import {
  ACCOUNT_DELETION_SELECT,
  type AccountDeletionRequestRow,
} from "@/lib/account-deletion/types";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revokeGoogleOAuthToken } from "@/lib/google/revokeToken";

export type FinalizeResult =
  | { ok: true; request: AccountDeletionRequestRow; skipped?: boolean }
  | { ok: false; error: string; request?: AccountDeletionRequestRow | null };

async function markFailed(id: string, reason: string): Promise<void> {
  await supabaseAdmin
    .from("account_deletion_requests")
    .update({
      status: "failed",
      failure_reason: reason.slice(0, 1000),
      claim_token: null,
    })
    .eq("id", id)
    .eq("status", "processing");
}

async function emptyStorageFolder(bucket: string, folder: string): Promise<void> {
  try {
    const { data } = await supabaseAdmin.storage.from(bucket).list(folder, {
      limit: 100,
    });
    if (!data?.length) return;
    const paths = data.filter((f) => f.name).map((f) => `${folder}/${f.name}`);
    if (paths.length) {
      await supabaseAdmin.storage.from(bucket).remove(paths);
    }
  } catch (err) {
    console.warn("account deletion storage", bucket, folder, err);
  }
}

async function disconnectGoogleForBarber(barberId: string): Promise<void> {
  const { data: googleAccount } = await supabaseAdmin
    .from("barber_google_accounts")
    .select("refresh_token, access_token")
    .eq("barber_id", barberId)
    .maybeSingle();

  const token =
    googleAccount?.refresh_token ?? googleAccount?.access_token ?? null;
  if (token) {
    await revokeGoogleOAuthToken(token);
  }

  await supabaseAdmin
    .from("barber_google_accounts")
    .delete()
    .eq("barber_id", barberId);

  await supabaseAdmin
    .from("barbers")
    .update({
      google_calendar_connected: false,
      google_calendar_id: null,
      google_access_token: null,
      google_refresh_token: null,
      google_token_expires_at: null,
    })
    .eq("id", barberId);
}

async function loadMemberships(
  userId: string,
): Promise<TenantMembershipSnapshot[]> {
  const { data: memberships, error } = await supabaseAdmin
    .from("tenant_users")
    .select("tenant_id, role, tenants(name)")
    .eq("user_id", userId);

  if (error) throw new Error(`tenant_users: ${error.message}`);

  const rows = memberships ?? [];
  const result: TenantMembershipSnapshot[] = [];

  for (const row of rows) {
    const { count } = await supabaseAdmin
      .from("tenant_users")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", row.tenant_id)
      .neq("user_id", userId);

    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("tenant_id", row.tenant_id)
      .maybeSingle();

    const tenant = row.tenants as { name?: string } | { name?: string }[] | null;
    const tenantName = Array.isArray(tenant)
      ? tenant[0]?.name ?? null
      : tenant?.name ?? null;

    result.push({
      tenantId: row.tenant_id,
      tenantName,
      role: row.role,
      otherMemberCount: count ?? 0,
      stripeSubscriptionId: sub?.stripe_subscription_id ?? null,
    });
  }

  return result;
}

async function loadBarbers(userId: string): Promise<BarberSnapshot[]> {
  const { data: barbers, error } = await supabaseAdmin
    .from("barbers")
    .select("id, tenant_id, avatar_url, google_calendar_connected")
    .eq("user_id", userId);

  if (error) throw new Error(`barbers: ${error.message}`);

  const result: BarberSnapshot[] = [];
  for (const barber of barbers ?? []) {
    const [{ count }, { data: googleAccount }] = await Promise.all([
      supabaseAdmin
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("barber_id", barber.id),
      supabaseAdmin
        .from("barber_google_accounts")
        .select("barber_id")
        .eq("barber_id", barber.id)
        .maybeSingle(),
    ]);

    result.push({
      id: barber.id,
      tenantId: barber.tenant_id,
      hasGoogle: Boolean(
        barber.google_calendar_connected || googleAccount?.barber_id,
      ),
      hasAvatar: Boolean(barber.avatar_url),
      bookingCount: count ?? 0,
    });
  }

  return result;
}

async function cancelStripeSubscription(subscriptionId: string): Promise<void> {
  try {
    await getStripe().subscriptions.cancel(subscriptionId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "stripe cancel failed";
    if (!/No such subscription|already been canceled|resource_missing/i.test(msg)) {
      throw new Error(`Stripe cancel: ${msg}`);
    }
  }
}

/**
 * Safe user-level finalization. Never deletes tenants or bookings.
 * Auth user is removed last. Idempotent: a retry after a partial run
 * continues from remaining rows.
 */
export async function finalizeAccountDeletion(
  request: AccountDeletionRequestRow,
): Promise<FinalizeResult> {
  if (request.status === "completed") {
    return { ok: true, request, skipped: true };
  }

  if (request.status !== "processing") {
    return {
      ok: false,
      error: `request_not_processing:${request.status}`,
      request,
    };
  }

  const userId = request.user_id;
  const warnings: string[] = [];

  try {
    if (!request.final_email_sent_at && request.email_snapshot) {
      await sendAccountDeletionCompletedEmail(request.email_snapshot);
      await supabaseAdmin
        .from("account_deletion_requests")
        .update({ final_email_sent_at: new Date().toISOString() })
        .eq("id", request.id);
    }

    if (userId) {
      const [memberships, barbers] = await Promise.all([
        loadMemberships(userId),
        loadBarbers(userId),
      ]);
      const plan = buildFinalizationPlan({ memberships, barbers });

      for (const barber of barbers) {
        await disconnectGoogleForBarber(barber.id);
        await emptyStorageFolder("barber-avatars", barber.id);
        const { error: anonError } = await supabaseAdmin
          .from("barbers")
          .update({
            user_id: null,
            active: false,
            display_name: ANONYMIZED_BARBER_DISPLAY_NAME,
            phone: null,
            avatar_url: null,
            bio: null,
            instagram_url: null,
            facebook_url: null,
            tiktok_url: null,
            google_calendar_connected: false,
            google_calendar_id: null,
            google_access_token: null,
            google_refresh_token: null,
            google_token_expires_at: null,
          })
          .eq("id", barber.id)
          .eq("user_id", userId);
        if (anonError) throw new Error(`anonymize barber: ${anonError.message}`);
      }

      for (const tenantId of plan.softCloseTenantIds) {
        const { error } = await supabaseAdmin
          .from("tenants")
          .update({ directory_listed: false })
          .eq("id", tenantId);
        if (error) warnings.push(`unlist ${tenantId}: ${error.message}`);
      }

      for (const membership of memberships) {
        if (
          plan.cancelStripeTenantIds.includes(membership.tenantId) &&
          membership.stripeSubscriptionId
        ) {
          await cancelStripeSubscription(membership.stripeSubscriptionId);
        }
      }

      const { error: membershipError } = await supabaseAdmin
        .from("tenant_users")
        .delete()
        .eq("user_id", userId);
      if (membershipError) {
        throw new Error(`tenant_users: ${membershipError.message}`);
      }

      await supabaseAdmin.from("user_active_tenant").delete().eq("user_id", userId);

      await supabaseAdmin
        .from("marketing_contacts")
        .update({
          user_id: null,
          status: "unsubscribed",
          marketing_consent: false,
          unsubscribed_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      await supabaseAdmin.from("platform_admins").delete().eq("user_id", userId);
      await supabaseAdmin.from("profiles").delete().eq("id", userId);

      const { data: authUser, error: authLookupError } =
        await supabaseAdmin.auth.admin.getUserById(userId);
      if (authLookupError && !/not.*found|user not found/i.test(authLookupError.message)) {
        throw new Error(`auth lookup: ${authLookupError.message}`);
      }
      if (authUser?.user) {
        const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (authErr && !/not.*found|user not found/i.test(authErr.message)) {
          throw new Error(`auth delete: ${authErr.message}`);
        }
      }
    }

    const { data: completed, error: completeError } = await supabaseAdmin
      .from("account_deletion_requests")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        failure_reason: warnings.length ? warnings.join("; ").slice(0, 1000) : null,
        claim_token: null,
        claimed_at: null,
      })
      .eq("id", request.id)
      .eq("status", "processing")
      .select(ACCOUNT_DELETION_SELECT)
      .maybeSingle();

    if (completeError || !completed) {
      throw new Error(completeError?.message || "could_not_mark_completed");
    }

    console.info("account deletion completed", {
      id: request.id,
      email: request.email_snapshot,
      warnings,
      at: new Date().toISOString(),
    });

    return { ok: true, request: completed as AccountDeletionRequestRow };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    console.error("account deletion finalize failed", {
      id: request.id,
      message,
    });
    await markFailed(request.id, message);
    return { ok: false, error: message, request };
  }
}

export async function claimDueAccountDeletions(limit = 5): Promise<AccountDeletionRequestRow[]> {
  const { data, error } = await supabaseAdmin.rpc("claim_account_deletion_batch", {
    p_limit: limit,
    p_lease_seconds: 900,
    p_max_attempts: 5,
    p_force_id: null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AccountDeletionRequestRow[];
}

export async function claimAccountDeletionById(
  requestId: string,
): Promise<AccountDeletionRequestRow | null> {
  const { data, error } = await supabaseAdmin.rpc("claim_account_deletion_batch", {
    p_limit: 1,
    p_lease_seconds: 900,
    p_max_attempts: 5,
    p_force_id: requestId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as AccountDeletionRequestRow[];
  return rows[0] ?? null;
}

export async function runDueAccountDeletions(limit = 5): Promise<{
  claimed: number;
  completed: number;
  failed: number;
  errors: string[];
}> {
  const claimed = await claimDueAccountDeletions(limit);
  let completed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const request of claimed) {
    const result = await finalizeAccountDeletion(request);
    if (result.ok) completed += 1;
    else {
      failed += 1;
      errors.push(`${request.id}: ${result.error}`);
    }
  }

  return { claimed: claimed.length, completed, failed, errors };
}
