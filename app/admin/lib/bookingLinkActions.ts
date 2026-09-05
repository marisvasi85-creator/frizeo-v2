"use server";

import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { getCurrentRole } from "@/lib/auth/getCurrentRole";
import { isBookingLinkCustomizationEnabled } from "@/lib/slugs/bookingLinkCustomization";
import {
  checkBarberBookingSlug,
  checkTenantBookingSlug,
  updateBarberBookingSlug,
  updateTenantBookingSlug,
} from "@/lib/slugs/updateBookingSlug";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { SaveFormState } from "../components/saveFormState";

export type BookingLinkFormState = SaveFormState & {
  tenantSlug?: string;
  barberSlug?: string;
  savedAt?: number;
};

export type BookingSlugKind = "tenant" | "barber";

const DISABLED_ERROR =
  "Personalizarea linkului este disponibilă deocamdată doar pe staging.";

export async function checkBookingLinkSlug(input: {
  kind: BookingSlugKind;
  slug: string;
}): Promise<{
  slug?: string;
  available: boolean;
  current?: boolean;
  error?: string;
}> {
  if (!isBookingLinkCustomizationEnabled()) {
    return { available: false, error: DISABLED_ERROR };
  }

  const barber = await getCurrentBarberInTenant();
  if (!barber) {
    return { available: false, error: "Nu ești autentificat." };
  }

  const role = await getCurrentRole();
  if (input.kind === "tenant" && role !== "owner") {
    return { available: false, error: "Doar proprietarul poate schimba linkul salonului." };
  }

  const parsed =
    input.kind === "tenant"
      ? await checkTenantBookingSlug(input.slug, barber.tenant_id)
      : await checkBarberBookingSlug(input.slug, barber.tenant_id, barber.id);

  if (!parsed.ok) {
    return { available: false, error: parsed.error };
  }

  return {
    slug: parsed.slug,
    available: parsed.available,
    current: parsed.current,
    error: parsed.available ? undefined : parsed.error,
  };
}

export async function updateBookingLink(
  _prev: BookingLinkFormState,
  formData: FormData,
): Promise<BookingLinkFormState> {
  if (!isBookingLinkCustomizationEnabled()) {
    return { success: false, error: DISABLED_ERROR };
  }

  const barber = await getCurrentBarberInTenant();
  if (!barber) {
    return { success: false, error: "Nu ești autentificat." };
  }

  const role = await getCurrentRole();
  const tenantSlugRaw = formData.get("tenant_slug");
  const barberSlugRaw = formData.get("barber_slug");
  const wantsTenant =
    typeof tenantSlugRaw === "string" && formData.has("tenant_slug");
  const wantsBarber =
    typeof barberSlugRaw === "string" && formData.has("barber_slug");

  if (!wantsTenant && !wantsBarber) {
    return { success: false, error: "Nu am primit niciun nume de link." };
  }

  if (wantsTenant && role !== "owner") {
    return {
      success: false,
      error: "Doar proprietarul salonului poate schimba linkul salonului.",
    };
  }

  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("slug")
    .eq("id", barber.tenant_id)
    .maybeSingle();

  let tenantSlug = tenant?.slug || "";
  let barberSlug =
    typeof barber.slug === "string" && barber.slug ? barber.slug : "";

  if (wantsTenant) {
    const tenantCheck = await checkTenantBookingSlug(
      tenantSlugRaw,
      barber.tenant_id,
    );
    if (!tenantCheck.ok) return { success: false, error: tenantCheck.error };
    if (!tenantCheck.available) {
      return { success: false, error: tenantCheck.error };
    }
  }

  if (wantsBarber) {
    const barberCheck = await checkBarberBookingSlug(
      barberSlugRaw,
      barber.tenant_id,
      barber.id,
    );
    if (!barberCheck.ok) return { success: false, error: barberCheck.error };
    if (!barberCheck.available) {
      return { success: false, error: barberCheck.error };
    }
  }

  if (wantsTenant) {
    const result = await updateTenantBookingSlug({
      tenantId: barber.tenant_id,
      nextSlug: tenantSlugRaw,
    });
    if (!result.success) return result;
    tenantSlug = result.slug;
  }

  if (wantsBarber) {
    const result = await updateBarberBookingSlug({
      tenantId: barber.tenant_id,
      barberId: barber.id,
      nextSlug: barberSlugRaw,
      tenantSlug,
    });
    if (!result.success) {
      return {
        ...result,
        tenantSlug,
        barberSlug,
      };
    }
    barberSlug = result.slug;
  }

  return {
    success: true,
    tenantSlug,
    barberSlug,
    savedAt: Date.now(),
  };
}
