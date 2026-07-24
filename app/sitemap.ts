import type { MetadataRoute } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getPublicBaseUrl } from "@/lib/seo/getPublicBaseUrl";
import { listDirectoryCities } from "@/lib/seo/directorySalons";

const publicPaths: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/pricing", changeFrequency: "weekly", priority: 0.9 },
  { path: "/signup", changeFrequency: "monthly", priority: 0.8 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.7 },
  { path: "/barbers", changeFrequency: "daily", priority: 0.7 },
  { path: "/frizerii", changeFrequency: "daily", priority: 0.8 },
  { path: "/frizerii/harta", changeFrequency: "daily", priority: 0.75 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.4 },
  { path: "/google-calendar-data", changeFrequency: "yearly", priority: 0.4 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.4 },
  { path: "/cookies", changeFrequency: "yearly", priority: 0.3 },
];

type ActiveBarberRow = {
  slug: string | null;
  updated_at?: string | null;
  tenant: { slug: string | null } | { slug: string | null }[] | null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await getPublicBaseUrl();
  const lastModified = new Date();

  const staticEntries: MetadataRoute.Sitemap = publicPaths.map(
    ({ path, changeFrequency, priority }) => ({
      url: `${base}${path}`,
      lastModified,
      changeFrequency,
      priority,
    })
  );

  const cities = await listDirectoryCities();
  const cityEntries: MetadataRoute.Sitemap = cities.map((c) => ({
    url: `${base}/frizerii/${c.slug}`,
    lastModified,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const { data: activeBarbers, error } = await supabaseAdmin
    .from("barbers")
    .select(
      `
      slug,
      updated_at,
      tenant:tenants!inner (
        slug
      )
    `
    )
    .eq("active", true);

  if (error) {
    console.error("sitemap salons:", error);
    return [...staticEntries, ...cityEntries];
  }

  const salonSlugs = new Map<string, Date>();
  const barberEntries: MetadataRoute.Sitemap = [];

  for (const row of (activeBarbers || []) as ActiveBarberRow[]) {
    const tenantRel = row.tenant;
    const tenantSlug = Array.isArray(tenantRel)
      ? tenantRel[0]?.slug
      : tenantRel?.slug;
    const barberSlug = row.slug?.trim();

    if (!tenantSlug || !barberSlug) continue;

    const modified = row.updated_at ? new Date(row.updated_at) : lastModified;
    const prev = salonSlugs.get(tenantSlug);
    if (!prev || modified > prev) {
      salonSlugs.set(tenantSlug, modified);
    }

    barberEntries.push({
      url: `${base}/booking/salon/${tenantSlug}/${barberSlug}`,
      lastModified: modified,
      changeFrequency: "daily",
      priority: 0.75,
    });
  }

  const salonEntries: MetadataRoute.Sitemap = [...salonSlugs.entries()].map(
    ([slug, modified]) => ({
      url: `${base}/booking/salon/${slug}`,
      lastModified: modified,
      changeFrequency: "daily" as const,
      priority: 0.85,
    })
  );

  return [
    ...staticEntries,
    ...cityEntries,
    ...salonEntries,
    ...barberEntries,
  ];
}
