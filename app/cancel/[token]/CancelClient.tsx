"use client";

import { useEffect } from "react";

export default function CancelClient({ token }: { token: string }) {
  useEffect(() => {
    fetch("/api/bookings/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then(console.log);
  }, [token]);

  return <div>Cancel token OK: {token}</div>;
}
