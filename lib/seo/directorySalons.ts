import { supabaseAdmin } from "@/lib/supabase/admin";
import { hasDirectoryListedMigration } from "@/lib/seo/hasDirectoryListedMigration";
import { cityToSlug, displayCityName } from "@/lib/seo/citySlug";
import {
  matchServiceFilters,
  type DirectoryFilterId,
} from "@/lib/seo/directoryFilters";

export type DirectorySalon = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  description: string | null;
  logo_url: string | null;
  location_city: string;
  location_county: string | null;
  location_address_line: string | null;
  location_latitude: number | null;
  location_longitude: number | null;
  active_barbers: number;
  filter_tags: DirectoryFilterId[];
  service_names: string[];
};

/** Salons opted into directory, with city + at least one active barber. */
export async function listDirectorySalons(options?: {
  citySlug?: string;
}): Promise<DirectorySalon[]> {
  const hasFlag = await hasDirectoryListedMigration();

  const { data: tenants, error } = await supabaseAdmin
    .from("tenants")
    .select(
      "id, name, slug, phone, description, logo_url, location_city, location_county, location_address_line, location_latitude, location_longitude"
    )
    .not("location_city", "is", null)
    .neq("location_city", "");

  if (error) {
    console.error("listDirectorySalons tenants:", error);
    return [];
  }

  let rows = (tenants || []) as Array<{
    id: string;
    name: string | null;
    slug: string | null;
    phone?: string | null;
    description?: string | null;
    logo_url?: string | null;
    location_city?: string | null;
    location_county?: string | null;
    location_address_line?: string | null;
    location_latitude?: number | null;
    location_longitude?: number | null;
  }>;

  if (hasFlag && rows.length > 0) {
    const { data: flagged, error: flagError } = await supabaseAdmin
      .from("tenants")
      .select("id, directory_listed")
      .in(
        "id",
        rows.map((t) => t.id)
      )
      .eq("directory_listed", true);

    if (flagError) {
      console.error("listDirectorySalons directory_listed:", flagError);
    } else {
      const allowed = new Set((flagged || []).map((t) => t.id as string));
      rows = rows.filter((t) => allowed.has(t.id));
    }
  }

  if (rows.length === 0) return [];

  const ids = rows.map((t) => t.id);
  const { data: barbers, error: barberError } = await supabaseAdmin
    .from("barbers")
    .select("id, tenant_id")
    .in("tenant_id", ids)
    .eq("active", true);

  if (barberError) {
    console.error("listDirectorySalons barbers:", barberError);
    return [];
  }

  const countByTenant = new Map<string, number>();
  const barberIds: string[] = [];
  const barberTenant = new Map<string, string>();

  for (const b of barbers || []) {
    const tid = b.tenant_id as string;
    const bid = b.id as string;
    countByTenant.set(tid, (countByTenant.get(tid) || 0) + 1);
    barberIds.push(bid);
    barberTenant.set(bid, tid);
  }

  const servicesByTenant = new Map<string, string[]>();
  if (barberIds.length > 0) {
    const { data: services } = await supabaseAdmin
      .from("barber_services")
      .select("barber_id, name, display_name")
      .in("barber_id", barberIds)
      .eq("active", true);

    for (const s of services || []) {
      const tid = barberTenant.get(s.barber_id as string);
      if (!tid) continue;
      const label =
        (typeof s.display_name === "string" && s.display_name.trim()) ||
        (typeof s.name === "string" && s.name.trim()) ||
        "";
      if (!label) continue;
      const list = servicesByTenant.get(tid) || [];
      list.push(label);
      servicesByTenant.set(tid, list);
    }
  }

  let list: DirectorySalon[] = [];
  for (const t of rows) {
    const city = t.location_city?.trim();
    const slug = t.slug?.trim();
    const name = t.name?.trim();
    const active = countByTenant.get(t.id) || 0;
    if (!city || !slug || !name || active < 1) continue;

    const serviceNames = [...new Set(servicesByTenant.get(t.id) || [])];

    list.push({
      id: t.id,
      name,
      slug,
      phone: t.phone ?? null,
      description: t.description ?? null,
      logo_url: t.logo_url ?? null,
      location_city: city,
      location_county: t.location_county ?? null,
      location_address_line: t.location_address_line ?? null,
      location_latitude:
        typeof t.location_latitude === "number" ? t.location_latitude : null,
      location_longitude:
        typeof t.location_longitude === "number" ? t.location_longitude : null,
      active_barbers: active,
      service_names: serviceNames,
      filter_tags: matchServiceFilters(serviceNames),
    });
  }

  if (options?.citySlug) {
    const target = options.citySlug.toLowerCase();
    list = list.filter((s) => cityToSlug(s.location_city) === target);
  }

  return list.sort((a, b) => a.name.localeCompare(b.name, "ro"));
}

export async function listDirectoryCities(): Promise<
  Array<{ city: string; slug: string; count: number }>
> {
  const salons = await listDirectorySalons();
  const counts = new Map<string, { city: string; count: number }>();

  for (const salon of salons) {
    const slug = cityToSlug(salon.location_city);
    if (!slug) continue;
    const prev = counts.get(slug);
    if (prev) {
      prev.count += 1;
    } else {
      counts.set(slug, {
        city: displayCityName(salon.location_city),
        count: 1,
      });
    }
  }

  return [...counts.entries()]
    .map(([slug, { city, count }]) => ({ slug, city, count }))
    .sort((a, b) => a.city.localeCompare(b.city, "ro"));
}
