import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { publicBookingPath } from "@/lib/booking/publicBookingPath";
import { createPageMetadata } from "@/lib/site/pageMetadata";

export const metadata = createPageMetadata({
  title: "Frizeri disponibili",
  description:
    "Alege un frizer și programează-te online. Pagini publice de programări Frizeo.",
  path: "/barbers",
  keywords: ["programare frizer online", "frizeri frizeo"],
});

export default async function BarbersPage() {
  const { data: barbers } = await supabaseAdmin
    .from("barbers")
    .select(`
      id,
      display_name,
      slug,
      tenant:tenants (
        slug
      )
    `)
    .eq("active", true)
    .order("display_name");

  return (
    <main className="max-w-4xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-semibold mb-10 text-center">
        Alege un frizer
      </h1>

      {!barbers?.length ? (
        <p className="text-center text-gray-500">
          Nu există frizeri disponibili momentan.
        </p>
      ) : (
        <div className="grid gap-4">
          {barbers.map((b) => {
            const tenantSlug = (b.tenant as { slug?: string } | null)?.slug;
            const href =
              tenantSlug && b.slug
                ? publicBookingPath(tenantSlug, b.slug)
                : `/booking/${b.id}`;

            return (
              <Link
                key={b.id}
                href={href}
                className="p-5 rounded-xl border hover:bg-gray-50 transition flex justify-between items-center"
              >
                <div>
                  <p className="font-medium text-lg">
                    {b.display_name || "Frizer"}
                  </p>
                  <p className="text-sm text-gray-500">
                    Vezi programări disponibile
                  </p>
                </div>

                <div className="text-gray-400 text-xl">→</div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
