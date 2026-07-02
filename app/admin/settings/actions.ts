"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { clampMinNoticeHours } from "@/lib/bookings/bookingLeadTime";
import type { SaveFormState } from "../components/saveFormState";

function toDBTime(t: string | null) {
  if (!t) return null;
  return t.length === 5 ? t + ":00" : t;
}

export async function saveWeeklySchedule(days: any[]) {
  const supabase = await createSupabaseServerClient();
  const barber = await getCurrentBarberInTenant();

  if (!barber) {
    redirect("/login");
  }

  await supabase
    .from("barber_weekly_schedule")
    .delete()
    .eq("barber_id", barber.id);

  const rows = days.map((d) => ({
    barber_id: barber.id,
    tenant_id: barber.tenant_id,
    day_of_week: d.day_of_week,
    is_working: d.is_working,
    work_start: toDBTime(d.work_start),
    work_end: toDBTime(d.work_end),
    break_enabled: !!d.break_enabled,
    break_start: d.break_enabled ? toDBTime(d.break_start) : null,
    break_end: d.break_enabled ? toDBTime(d.break_end) : null,
  }));

  const { error } = await supabase
    .from("barber_weekly_schedule")
    .insert(rows);

  if (error) {
    console.error("SAVE SCHEDULE ERROR:", error);
  }
}

export async function saveBookingRules(
  _prev: SaveFormState,
  formData: FormData,
): Promise<SaveFormState> {
  try {
    const barber = await getCurrentBarberInTenant();

    if (!barber) {
      return { success: false, error: "Nu ești autentificat." };
    }

    const minBookingNoticeHours = clampMinNoticeHours(
      formData.get("min_booking_notice_hours"),
    );

    const { data, error } = await supabaseAdmin
      .from("barbers")
      .update({ min_booking_notice_hours: minBookingNoticeHours })
      .eq("id", barber.id)
      .select("id")
      .single();

    if (error) {
      console.error("SAVE BOOKING RULES ERROR:", error);
      return {
        success: false,
        error: "Nu s-au putut salva regulile de programare.",
      };
    }

    if (!data) {
      return {
        success: false,
        error: "Nu s-au putut salva regulile de programare.",
      };
    }

    revalidatePath("/admin/settings");
    return { success: true };
  } catch (err) {
    console.error("SAVE BOOKING RULES ERROR:", err);
    return {
      success: false,
      error: "Nu s-au putut salva regulile de programare.",
    };
  }
}
