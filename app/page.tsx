import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = supabaseServer();

  const { data: barbers, error } = await supabase
    .from("barbers")
    .select("id, display_name")
    .eq("active", true);

  if (error) {
    return <p>Eroare la încărcare frizeri</p>;
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Alege frizerul</h1>

      {barbers?.map((b) => (
        <div key={b.id}>
          <Link href={`/booking/${b.id}`}>
            {b.display_name}
          </Link>
        </div>
      ))}
    </div>
  );
}
