import { supabase } from "@/lib/supabase/server";

export default async function Home() {
  // test simplu că funcționează
  const { data } = await supabase.from("barbers").select("id").limit(1);

  return (
    <main>
      <h1>Frizeo</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </main>
  );
}
