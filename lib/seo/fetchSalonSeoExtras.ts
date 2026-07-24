import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  buildOpeningHours,
  buildOpeningHoursSpecification,
  buildPriceRange,
  type WeeklyScheduleRow,
} from "@/lib/seo/salonSeo";

/** Active barbers' schedules + service prices for a salon (SEO / JSON-LD). */
export async function fetchSalonSeoExtras(tenantId: string): Promise<{
  scheduleRows: WeeklyScheduleRow[];
  openingHours: string[];
  openingHoursSpecification: ReturnType<typeof buildOpeningHoursSpecification>;
  priceRange: string | null;
  galleryUrls: string[];
}> {
  const { data: barbers } = await supabaseAdmin
    .from("barbers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("active", true);

  const barberIds = (barbers || []).map((b) => b.id);

  const [scheduleRes, servicesRes, galleryRes] = await Promise.all([
    barberIds.length > 0
      ? supabaseAdmin
          .from("barber_weekly_schedule")
          .select("day_of_week, is_working, work_start, work_end")
          .in("barber_id", barberIds)
      : Promise.resolve({ data: [] as WeeklyScheduleRow[] }),
    barberIds.length > 0
      ? supabaseAdmin
          .from("barber_services")
          .select("price")
          .in("barber_id", barberIds)
          .eq("active", true)
      : Promise.resolve({ data: [] as Array<{ price: number | null }> }),
    supabaseAdmin
      .from("salon_gallery")
      .select("image_url")
      .eq("tenant_id", tenantId)
      .order("created_at")
      .limit(8),
  ]);

  const scheduleRows = (scheduleRes.data || []) as WeeklyScheduleRow[];
  const openingHoursSpecification = buildOpeningHoursSpecification(scheduleRows);
  const openingHours = buildOpeningHours(scheduleRows);
  const priceRange = buildPriceRange(
    (servicesRes.data || []).map((s) => s.price)
  );
  const galleryUrls = (galleryRes.data || [])
    .map((g) => g.image_url)
    .filter((url): url is string => typeof url === "string" && Boolean(url));

  return {
    scheduleRows,
    openingHours,
    openingHoursSpecification,
    priceRange,
    galleryUrls,
  };
}
