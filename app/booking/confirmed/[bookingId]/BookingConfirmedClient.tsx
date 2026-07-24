"use client";

import { useEffect, useState } from "react";

export default function BookingConfirmed({ bookingId }: { bookingId: string }) {
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/bookings/confirm-meta?id=${bookingId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.reviewUrl) setReviewUrl(data.reviewUrl);
      } catch {
        // optional
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-2xl font-semibold text-green-600">
        ✔ Programare confirmată
      </h1>

      <p className="mt-2 text-gray-600">Am trimis un email de confirmare.</p>

      <p className="text-sm text-gray-400">Verifică inbox / spam.</p>

      {reviewUrl && (
        <a
          href={reviewUrl}
          className="mt-8 inline-block bg-black text-white px-5 py-3 rounded-xl text-sm font-medium"
        >
          Lasă o recenzie
        </a>
      )}
    </div>
  );
}
