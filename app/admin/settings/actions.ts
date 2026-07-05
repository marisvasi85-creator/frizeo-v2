"use server";

import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { clampMinNoticeHours } from "@/lib/bookings/bookingLeadTime";
import { toDBTime } from "@/lib/schedule/time";
import type { SaveFormState } from "../components/saveFormState";

type ScheduleDay = {
  day_of_week: number;
  is_working: boolean;
  work_start: string | null;
  work_end: string | null;
  break_enabled: boolean;
  break_start: string | null;
  break_end: string | null;
};

export async function saveWeeklySchedule(
  days: ScheduleDay[]
): Promise<SaveFormState> {
  try {
    const barber = await getCurrentBarberInTenant();

    if (!barber) {
      return { success: false, error: "Nu ești autentificat." };
    }

    const { error: deleteError } = await supabaseAdmin
      .from("barber_weekly_schedule")
      .delete()
      .eq("barber_id", barber.id);

    if (deleteError) {
      console.error("SAVE SCHEDULE DELETE ERROR:", deleteError);
      return {
        success: false,
        error: "Nu s-a putut salva programul de lucru.",
      };
    }

    const rows = days.map((d) => ({
      barber_id: barber.id,
      tenant_id: barber.tenant_id,
      day_of_week: d.day_of_week,
      is_working: d.is_working,
      work_start: d.is_working ? toDBTime(d.work_start) : null,
      work_end: d.is_working ? toDBTime(d.work_end) : null,
      break_enabled: d.is_working && !!d.break_enabled,
      break_start:
        d.is_working && d.break_enabled ? toDBTime(d.break_start) : null,
      break_end:
        d.is_working && d.break_enabled ? toDBTime(d.break_end) : null,
    }));

    const { error: insertError } = await supabaseAdmin
      .from("barber_weekly_schedule")
      .insert(rows);

    if (insertError) {
      console.error("SAVE SCHEDULE INSERT ERROR:", insertError);
      return {
        success: false,
        error: "Nu s-a putut salva programul de lucru.",
      };
    }

    revalidatePath("/admin/settings");
    return { success: true };
  } catch (err) {
    console.error("SAVE SCHEDULE ERROR:", err);
    return {
      success: false,
      error: "Nu s-a putut salva programul de lucru.",
    };
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
