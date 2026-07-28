import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/app/getAppUrl";
import { ensureBarberSlug } from "@/lib/barbers/ensureBarberSlug";
import BarbersClient from "./BarbersClient";

export default async function BarbersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const session = await getAdminSession();
  const { role: roleHint } = await searchParams;

  if (!session?.tenantId) {
    redirect("/login");
  }

  if (session.role !== "owner") {
    redirect("/admin/dashboard");
  }

  const tenantId = session.tenantId;

  const [barbersRes, invitesRes, subscriptionRes, tenantRes] =
    await Promise.all([
      supabaseAdmin
        .from("barbers")
        .select("id, display_name, phone, active, slug, tenant_id, user_id")
        .eq("tenant_id", tenantId)
        .order("display_name"),
      supabaseAdmin
        .from("barber_invitations")
        .select("id, full_name, email, phone, accepted, created_at")
        .eq("tenant_id", tenantId)
        .eq("accepted", false)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("subscriptions")
        .select(
          `
      status,
      trial_ends_at,
      stripe_subscription_id,
      plan:plans (
        name,
        max_barbers
      )
    `,
        )
        .eq("tenant_id", tenantId)
        .single(),
      supabaseAdmin.from("tenants").select("slug").eq("id", tenantId).single(),
    ]);

  const invitations = invitesRes.data || [];
  const subscription = subscriptionRes.data;
  const tenant = tenantRes.data;

  const barbers = await Promise.all(
    (barbersRes.data || []).map(async (row) => {
      if (row.slug) return row;
      try {
        const slug = await ensureBarberSlug({
          id: row.id,
          tenant_id: row.tenant_id,
          display_name: row.display_name,
          slug: row.slug,
        });
        return { ...row, slug };
      } catch {
        return row;
      }
    }),
  );

  const plan = subscription?.plan as
    | { name?: string; max_barbers?: number | null }
    | null
    | undefined;

  const activeBarbers = barbers.filter((b) => b.active).length;
  const pendingInvites = invitations.length;
  const maxBarbers = plan?.max_barbers ?? null;
  const ownerBarber = barbers.find((b) => b.user_id === session.user.id);
  const ownerActsAsBarber = Boolean(ownerBarber?.active);
  const isOverLimit =
    maxBarbers !== null && activeBarbers > maxBarbers;

  const isTrial =
    subscription?.status === "trialing" &&
    !subscription?.stripe_subscription_id;
  const trialEnds = subscription?.trial_ends_at
    ? new Date(subscription.trial_ends_at)
    : null;
  // Server request time — countdown for admin display
  // eslint-disable-next-line react-hooks/purity -- intentional per-request clock
  const nowMs = Date.now();
  const trialDaysLeft = trialEnds
    ? Math.max(0, Math.ceil((trialEnds.getTime() - nowMs) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <BarbersClient
      currentPlan={
        isTrial
          ? `Trial Pro+ (${trialDaysLeft} zile)`
          : (plan?.name ?? "Free")
      }
      activeBarbers={activeBarbers}
      pendingInvites={pendingInvites}
      maxBarbers={maxBarbers}
      isOverLimit={isOverLimit}
      ownerUserId={session.user.id}
      ownerActsAsBarber={ownerActsAsBarber}
      highlightOwnerRole={roleHint === "admin-only"}
      tenantSlug={tenant?.slug ?? ""}
      appUrl={getAppUrl()}
      initialBarbers={barbers}
      initialInvitations={invitations}
    />
  );
}
