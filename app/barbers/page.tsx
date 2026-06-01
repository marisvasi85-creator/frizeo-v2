import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function BarbersPage() {
  const supabase = await createSupabaseServerClient();

  const { data: barbers } = await supabase
    .from("barbers")
    .select("id, display_name")
    .order("display_name");

  return (
    <main className="max-w-4xl mx-auto px-6 py-16">

      <h1 className="text-3xl font-semibold mb-10 text-center">
        Alege un frizer
      </h1>

      <div className="grid gap-4">
        {barbers?.map((b) => (
          <Link
            key={b.id}
            href={`/booking/${b.id}`}
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
        ))}
      </div>

    </main>
  );
}