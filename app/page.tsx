import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";

export default async function Home() {
  const { data: barbers, error } = await supabaseAdmin
    .from("barbers")
    .select("*");

  if (error) {
    throw new Error(error.message);
  }

  return (
    <main>
      <h1>Barbers</h1>

      <ul>
        {barbers?.map((barber) => (
          <li key={barber.id}>
            <Link href={`/booking/${barber.id}`}>
              {barber.name}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
