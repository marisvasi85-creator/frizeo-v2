import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  publicBookingPath,
  publicSalonPath,
} from "@/lib/booking/publicBookingPath";
import {
  BOOKING_SLUG_CHANGE_LIMIT,
  BOOKING_SLUG_CHANGE_WINDOW_MS,
  parseBookingSlug,
} from "./bookingSlug";
import {
  isBarberSlugAvailable,
  isTenantSlugAvailable,
} from "./slugAvailability";
import {
  clearOwnSlugRedirect,
  countRecentSlugChanges,
  recordSlugRedirect,
} from "./slugRedirects";

export type BookingSlugKind = "tenant" | "barber";

export type BookingSlugCheckResult =
  | { ok: true; slug: string; available: true; current: boolean }
  | { ok: true; slug: string; available: false; current: false; error: string }
  | { ok: false; error: string };

function uniqueViolation(message?: string) {
  return !!message && (message.includes("duplicate") || message.includes("23505"));
}

function rateLimitError() {
  return `Poți schimba linkul de cel mult ${BOOKING_SLUG_CHANGE_LIMIT} ori pe zi. Linkurile vechi rămân valabile.`;
}

async function assertRateLimit(input: {
  entityType: BookingSlugKind;
  entityId: string;
}): Promise<string | null> {
  const sinceIso = new Date(Date.now() - BOOKING_SLUG_CHANGE_WINDOW_MS).toISOString();
  const recent = await countRecentSlugChanges({
    entityType: input.entityType,
    entityId: input.entityId,
    sinceIso,
  });

  if (recent >= BOOKING_SLUG_CHANGE_LIMIT) {
    return rateLimitError();
  }

  return null;
}

export async function checkTenantBookingSlug(
  slugInput: string,
  tenantId: string,
): Promise<BookingSlugCheckResult> {
  const parsed = parseBookingSlug(slugInput);
  if (!parsed.ok) return parsed;

  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("slug")
    .eq("id", tenantId)
    .maybeSingle();

  if (tenant?.slug === parsed.slug) {
    return { ok: true, slug: parsed.slug, available: true, current: true };
  }

  const available = await isTenantSlugAvailable(parsed.slug, tenantId);
  if (!available) {
    return {
      ok: true,
      slug: parsed.slug,
      available: false,
      current: false,
      error: "Acest nume este deja folosit. Alege altul.",
    };
  }

  return { ok: true, slug: parsed.slug, available: true, current: false };
}

export async function checkBarberBookingSlug(
  slugInput: string,
  tenantId: string,
  barberId: string,
): Promise<BookingSlugCheckResult> {
  const parsed = parseBookingSlug(slugInput);
  if (!parsed.ok) return parsed;

  const { data: barber } = await supabaseAdmin
    .from("barbers")
    .select("slug")
    .eq("id", barberId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (barber?.slug === parsed.slug) {
    return { ok: true, slug: parsed.slug, available: true, current: true };
  }

  const available = await isBarberSlugAvailable(tenantId, parsed.slug, barberId);
  if (!available) {
    return {
      ok: true,
      slug: parsed.slug,
      available: false,
      current: false,
      error: "Acest nume este deja folosit în salon. Alege altul.",
    };
  }

  return { ok: true, slug: parsed.slug, available: true, current: false };
}

function revalidateBookingPaths(input: {
  tenantId: string;
  oldTenantSlug?: string | null;
  newTenantSlug?: string | null;
  barberId?: string | null;
  oldBarberSlug?: string | null;
  newBarberSlug?: string | null;
}) {
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/salon");
  revalidatePath("/admin/profile");
  revalidatePath("/admin/barbers");
  revalidatePath("/frizerii");

  const tenantSlug = input.newTenantSlug || input.oldTenantSlug;
  if (input.oldTenantSlug) {
    revalidatePath(publicSalonPath(input.oldTenantSlug));
  }
  if (input.newTenantSlug && input.newTenantSlug !== input.oldTenantSlug) {
    revalidatePath(publicSalonPath(input.newTenantSlug));
  }

  if (tenantSlug && input.oldBarberSlug) {
    revalidatePath(publicBookingPath(tenantSlug, input.oldBarberSlug));
    if (input.oldTenantSlug && input.oldTenantSlug !== tenantSlug) {
      revalidatePath(publicBookingPath(input.oldTenantSlug, input.oldBarberSlug));
    }
  }

  if (tenantSlug && input.newBarberSlug) {
    revalidatePath(publicBookingPath(tenantSlug, input.newBarberSlug));
  }

  if (input.oldTenantSlug && input.newBarberSlug) {
    revalidatePath(publicBookingPath(input.oldTenantSlug, input.newBarberSlug));
  }

  if (input.barberId) {
    revalidatePath(`/booking/${input.barberId}`);
  }
}

export async function updateTenantBookingSlug(input: {
  tenantId: string;
  nextSlug: string;
}): Promise<{ success: true; slug: string } | { success: false; error: string }> {
  const check = await checkTenantBookingSlug(input.nextSlug, input.tenantId);
  if (!check.ok) return { success: false, error: check.error };
  if (!check.available) return { success: false, error: check.error };

  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from("tenants")
    .select("id, slug")
    .eq("id", input.tenantId)
    .maybeSingle();

  if (tenantError || !tenant) {
    return { success: false, error: "Nu am găsit salonul." };
  }

  if (tenant.slug === check.slug) {
    return { success: true, slug: check.slug };
  }

  const limited = await assertRateLimit({
    entityType: "tenant",
    entityId: tenant.id,
  });
  if (limited) return { success: false, error: limited };

  if (tenant.slug) {
    const recorded = await recordSlugRedirect({
      entityType: "tenant",
      entityId: tenant.id,
      oldSlug: tenant.slug,
    });
    if (!recorded) {
      return {
        success: false,
        error: "Nu am putut păstra linkul vechi. Încearcă din nou.",
      };
    }
  }

  await clearOwnSlugRedirect({
    entityType: "tenant",
    entityId: tenant.id,
    slug: check.slug,
  });

  const { error: updateError } = await supabaseAdmin
    .from("tenants")
    .update({ slug: check.slug })
    .eq("id", tenant.id);

  if (updateError) {
    console.error("updateTenantBookingSlug:", updateError);
    return {
      success: false,
      error: uniqueViolation(updateError.message)
        ? "Acest nume este deja folosit. Alege altul."
        : "Nu s-a putut salva linkul salonului.",
    };
  }

  revalidateBookingPaths({
    tenantId: tenant.id,
    oldTenantSlug: tenant.slug,
    newTenantSlug: check.slug,
  });

  return { success: true, slug: check.slug };
}

export async function updateBarberBookingSlug(input: {
  tenantId: string;
  barberId: string;
  nextSlug: string;
  tenantSlug?: string | null;
}): Promise<{ success: true; slug: string } | { success: false; error: string }> {
  const check = await checkBarberBookingSlug(
    input.nextSlug,
    input.tenantId,
    input.barberId,
  );
  if (!check.ok) return { success: false, error: check.error };
  if (!check.available) return { success: false, error: check.error };

  const { data: barber, error: barberError } = await supabaseAdmin
    .from("barbers")
    .select("id, slug, tenant_id")
    .eq("id", input.barberId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();

  if (barberError || !barber) {
    return { success: false, error: "Nu am găsit profilul de frizer." };
  }

  if (barber.slug === check.slug) {
    return { success: true, slug: check.slug };
  }

  const limited = await assertRateLimit({
    entityType: "barber",
    entityId: barber.id,
  });
  if (limited) return { success: false, error: limited };

  if (barber.slug) {
    const recorded = await recordSlugRedirect({
      entityType: "barber",
      entityId: barber.id,
      oldSlug: barber.slug,
      tenantId: barber.tenant_id,
    });
    if (!recorded) {
      return {
        success: false,
        error: "Nu am putut păstra linkul vechi. Încearcă din nou.",
      };
    }
  }

  await clearOwnSlugRedirect({
    entityType: "barber",
    entityId: barber.id,
    slug: check.slug,
    tenantId: barber.tenant_id,
  });

  const { error: updateError } = await supabaseAdmin
    .from("barbers")
    .update({ slug: check.slug })
    .eq("id", barber.id)
    .eq("tenant_id", barber.tenant_id);

  if (updateError) {
    console.error("updateBarberBookingSlug:", updateError);
    return {
      success: false,
      error: uniqueViolation(updateError.message)
        ? "Acest nume este deja folosit. Alege altul."
        : "Nu s-a putut salva linkul frizerului.",
    };
  }

  revalidateBookingPaths({
    tenantId: barber.tenant_id,
    oldTenantSlug: input.tenantSlug,
    newTenantSlug: input.tenantSlug,
    barberId: barber.id,
    oldBarberSlug: barber.slug,
    newBarberSlug: check.slug,
  });

  return { success: true, slug: check.slug };
}
