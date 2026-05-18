"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function CancelPage() {
  const params = useParams();
  const token = params?.token as string;

  const [status, setStatus] = useState("Se procesează...");

  useEffect(() => {
    if (!token) return;

    const cancel = async () => {
      const res = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus(data.error || "Eroare");
        return;
      }

      setStatus("Programarea a fost anulată");
    };

    cancel();
  }, [token]);

  return <div className="p-6 text-center">{status}</div>;
}