import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hasSlugRedirectsMigration } from "./hasSlugRedirectsMigration";
import type { BarberLocationFields, LocationFields } from "@/lib/location/types";

type TenantRow = LocationFields & {
  id: string;
  name: string;
  slug: string;
  phone?: string | null;
  description?: string | null;
  logo_url?: string | null;
  address?: string | null;
};

type BarberRow = BarberLocationFields & {
  id: string;
  display_name?: string | null;
  slug: string;
};

export type ResolvedTenantSlug = {
  tenant: TenantRow;
  canonicalSlug: string;
  redirected: boolean;
};

export type ResolvedBarberSlug = {
  barber: BarberRow;
  canonicalSlug: string;
  redirected: boolean;
};

async function findTenantRedirect(oldSlug: string) {
  if (!(await hasSlugRedirectsMigration())) {
    return null;
  }

  const { data: redirect } = await supabaseAdmin
    .from("slug_redirects")
    .select("entity_id")
    .eq("entity_type", "tenant")
    .eq("old_slug", oldSlug)
    .maybeSingle();

  if (!redirect) {
    return null;
  }

  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("*")
    .eq("id", redirect.entity_id)
    .maybeSingle();

  if (!tenant?.slug) {
    return null;
  }

  return tenant as TenantRow;
}

async function findBarberRedirect(
  tenantId: string,
  oldSlug: string
) {
  if (!(await hasSlugRedirectsMigration())) {
    return null;
  }

  const { data: redirect } = await supabaseAdmin
    .from("slug_redirects")
    .select("entity_id")
    .eq("entity_type", "barber")
    .eq("tenant_id", tenantId)
    .eq("old_slug", oldSlug)
    .maybeSingle();

  if (!redirect) {
    return null;
  }

  const { data: barber } = await supabaseAdmin
    .from("barbers")
    .select("*")
    .eq("id", redirect.entity_id)
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .maybeSingle();

  if (!barber?.slug) {
    return null;
  }

  return barber as BarberRow;
}

export const resolveTenantBySlug = cache(
  async (slug: string): Promise<ResolvedTenantSlug | null> => {
    const { data: direct } = await supabaseAdmin
      .from("tenants")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (direct) {
      return {
        tenant: direct as TenantRow,
        canonicalSlug: direct.slug,
        redirected: false,
      };
    }

    const redirectedTenant = await findTenantRedirect(slug);

    if (!redirectedTenant) {
      return null;
    }

    return {
      tenant: redirectedTenant,
      canonicalSlug: redirectedTenant.slug,
      redirected: true,
    };
  },
);

export const resolveBarberBySlug = cache(
  async (
    tenantId: string,
    barberSlug: string,
  ): Promise<ResolvedBarberSlug | null> => {
    const { data: direct } = await supabaseAdmin
      .from("barbers")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("slug", barberSlug)
      .eq("active", true)
      .maybeSingle();

    if (direct) {
      return {
        barber: direct as BarberRow,
        canonicalSlug: direct.slug,
        redirected: false,
      };
    }

    const redirectedBarber = await findBarberRedirect(tenantId, barberSlug);

    if (!redirectedBarber) {
      return null;
    }

    return {
      barber: redirectedBarber,
      canonicalSlug: redirectedBarber.slug,
      redirected: true,
    };
  },
);

export async function recordSlugRedirect(input: {
  entityType: "tenant" | "barber";
  entityId: string;
  oldSlug: string;
  tenantId?: string;
}) {
  if (!(await hasSlugRedirectsMigration())) {
    return;
  }

  const oldSlug = input.oldSlug.trim().toLowerCase();

  if (!oldSlug) {
    return;
  }

  let existingQuery = supabaseAdmin
    .from("slug_redirects")
    .select("id")
    .eq("entity_type", input.entityType)
    .eq("old_slug", oldSlug);

  if (input.entityType === "barber") {
    existingQuery = existingQuery.eq("tenant_id", input.tenantId ?? "");
  }

  const { data: existing } = await existingQuery.maybeSingle();

  if (existing) {
    return;
  }

  const payload =
    input.entityType === "tenant"
      ? {
          entity_type: "tenant" as const,
          entity_id: input.entityId,
          old_slug: oldSlug,
          tenant_id: null,
        }
      : {
          entity_type: "barber" as const,
          entity_id: input.entityId,
          old_slug: oldSlug,
          tenant_id: input.tenantId ?? null,
        };

  const { error } = await supabaseAdmin.from("slug_redirects").insert(payload);

  if (error) {
    console.error("recordSlugRedirect:", error);
  }
}
