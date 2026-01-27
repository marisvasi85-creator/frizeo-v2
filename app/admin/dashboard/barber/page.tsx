"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentBarber } from "@/lib/supabase/getCurrentBarber";

export default function BarberDashboardPage() {
  const router = useRouter();
  const [barber, setBarber] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const b = await getCurrentBarber();

      if (!b) {
        // ❌ nu e barber → logout logic
        router.replace("/login");
        return;
      }

      setBarber(b);
      setLoading(false);
    };

    load();
  }, [router]);

  if (loading) {
    return <p>Se încarcă dashboard-ul...</p>;
  }

  return (
    <div>
      <h1>Dashboard frizer</h1>
      <p>ID barber: {barber.id}</p>
      <p>Nume: {barber.display_name}</p>
    </div>
  );
}
