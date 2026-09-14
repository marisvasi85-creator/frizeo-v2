import {
  demoteOwnerRoleAfterTransfer,
  type TenantMembershipSnapshot,
} from "@/lib/account-deletion/decisions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type EligibleOwnershipMember = {
  userId: string;
  role: string;
  displayName: string | null;
  email: string | null;
};

export type OwnershipTransferBlock = {
  tenantId: string;
  tenantName: string | null;
  eligibleMembers: EligibleOwnershipMember[];
};

export async function loadMembershipSnapshots(
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
    const [{ count: otherMemberCount }, { count: otherOwnerCount }, { data: sub }] =
      await Promise.all([
        supabaseAdmin
          .from("tenant_users")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", row.tenant_id)
          .neq("user_id", userId),
        supabaseAdmin
          .from("tenant_users")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", row.tenant_id)
          .eq("role", "owner")
          .neq("user_id", userId),
        supabaseAdmin
          .from("subscriptions")
          .select("stripe_subscription_id")
          .eq("tenant_id", row.tenant_id)
          .maybeSingle(),
      ]);

    const tenant = row.tenants as { name?: string } | { name?: string }[] | null;
    const tenantName = Array.isArray(tenant)
      ? tenant[0]?.name ?? null
      : tenant?.name ?? null;

    result.push({
      tenantId: row.tenant_id,
      tenantName,
      role: row.role,
      otherMemberCount: otherMemberCount ?? 0,
      otherOwnerCount: otherOwnerCount ?? 0,
      stripeSubscriptionId: sub?.stripe_subscription_id ?? null,
    });
  }

  return result;
}

export async function listEligibleOwnershipMembers(
  tenantId: string,
  fromUserId: string,
): Promise<EligibleOwnershipMember[]> {
  const { data: members, error } = await supabaseAdmin
    .from("tenant_users")
    .select("user_id, role")
    .eq("tenant_id", tenantId)
    .neq("user_id", fromUserId);

  if (error) throw new Error(`eligible members: ${error.message}`);
  const rows = members ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.user_id);
  const [{ data: profiles }, { data: barbers }] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, full_name").in("id", ids),
    supabaseAdmin
      .from("barbers")
      .select("user_id, display_name")
      .eq("tenant_id", tenantId)
      .in("user_id", ids),
  ]);

  const profileById = new Map(
    (profiles ?? []).map((row) => [row.id as string, row.full_name as string | null]),
  );
  const barberByUser = new Map(
    (barbers ?? []).map((row) => [
      row.user_id as string,
      row.display_name as string | null,
    ]),
  );

  const result: EligibleOwnershipMember[] = [];
  for (const row of rows) {
    let email: string | null = null;
    try {
      const { data } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
      email = data.user?.email ?? null;
    } catch {
      email = null;
    }
    result.push({
      userId: row.user_id,
      role: row.role,
      displayName:
        barberByUser.get(row.user_id) ||
        profileById.get(row.user_id) ||
        email?.split("@")[0] ||
        null,
      email,
    });
  }

  return result.sort((a, b) =>
    (a.displayName || a.email || a.userId).localeCompare(
      b.displayName || b.email || b.userId,
      "ro",
    ),
  );
}

export async function loadOwnershipTransferBlocks(
  userId: string,
  memberships?: TenantMembershipSnapshot[],
): Promise<OwnershipTransferBlock[]> {
  const snaps = memberships ?? (await loadMembershipSnapshots(userId));
  const blocked = snaps.filter(
    (row) =>
      row.role === "owner" &&
      row.otherOwnerCount === 0 &&
      row.otherMemberCount > 0,
  );

  const result: OwnershipTransferBlock[] = [];
  for (const row of blocked) {
    result.push({
      tenantId: row.tenantId,
      tenantName: row.tenantName,
      eligibleMembers: await listEligibleOwnershipMembers(row.tenantId, userId),
    });
  }
  return result;
}

export async function transferTenantOwnership(input: {
  tenantId: string;
  toUserId: string;
  fromUserId: string;
  hasBarberRow: boolean;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (input.toUserId === input.fromUserId) {
    return { ok: false, error: "Nu poți transfera ownership-ul către tine.", status: 400 };
  }

  const fromNewRole = demoteOwnerRoleAfterTransfer(input.hasBarberRow);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("transfer_tenant_ownership", {
    p_tenant_id: input.tenantId,
    p_to_user_id: input.toUserId,
    p_from_new_role: fromNewRole,
  });

  if (error) {
    const message = error.message || "Nu am putut transfera ownership-ul.";
    if (/not_authenticated/i.test(message)) {
      return { ok: false, error: "Unauthorized", status: 401 };
    }
    if (/not_owner/i.test(message)) {
      return {
        ok: false,
        error: "Doar owner-ul actual poate transfera ownership-ul.",
        status: 403,
      };
    }
    if (/target_not_member/i.test(message)) {
      return {
        ok: false,
        error: "Membrul selectat nu face parte din salon.",
        status: 400,
      };
    }
    if (/invalid_target|same_user/i.test(message)) {
      return { ok: false, error: "Membru invalid.", status: 400 };
    }
    console.error("transfer_tenant_ownership", error);
    return { ok: false, error: "Nu am putut transfera ownership-ul.", status: 500 };
  }

  return { ok: true };
}
