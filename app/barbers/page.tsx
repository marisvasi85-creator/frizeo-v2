import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stableBookingPath } from "@/lib/booking/publicBookingPath";
import { hasDirectoryListedMigration } from "@/lib/seo/hasDirectoryListedMigration";
import { createPageMetadata } from "@/lib/site/pageMetadata";

export const metadata = createPageMetadata({
  title: "Frizeri disponibili",
  description:
    "Alege un frizer și programează-te online. Pagini publice de programări Frizeo.",
  path: "/barbers",
  keywords: ["programare frizer online", "frizeri frizeo"],
  // Thin duplicate of /frizerii — keep usable, do not push into the index.
  noIndex: true,
});

type BarberRow = {
  id: string;
  display_name: string | null;
  slug: string | null;
  tenant_id: string;
  tenant: { slug: string | null } | { slug: string | null }[] | null;
};

export default async function BarbersPage() {
  const hasDirectoryFlag = await hasDirectoryListedMigration();

  const { data: barbers } = await supabaseAdmin
    .from("barbers")
    .select(
      `
      id,
      display_name,
      slug,
      tenant_id,
      tenant:tenants (
        slug
      )
    `
    )
    .eq("active", true)
    .order("display_name");

  let rows = (barbers || []) as BarberRow[];

  if (hasDirectoryFlag && rows.length > 0) {
    const { data: listed, error } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .in(
        "id",
        rows.map((b) => b.tenant_id)
      )
      .eq("directory_listed", true);

    if (error) {
      console.error("barbers directory_listed:", error);
      rows = [];
    } else {
      const allowed = new Set((listed || []).map((t) => t.id as string));
      rows = rows.filter((b) => allowed.has(b.tenant_id));
    }
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-semibold mb-4 text-center">
        Alege un frizer
      </h1>
      <p className="text-center text-sm text-gray-500 mb-10">
        Preferă directorul pe orașe:{" "}
        <Link href="/frizerii" className="text-black underline">
          Frizerii pe Frizeo
        </Link>
        .
      </p>

      {!rows.length ? (
        <p className="text-center text-gray-500">
          Nu există frizeri disponibili momentan.
        </p>
      ) : (
        <div className="grid gap-4">
          {rows.map((b) => {
            const href = stableBookingPath(b.id);

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
