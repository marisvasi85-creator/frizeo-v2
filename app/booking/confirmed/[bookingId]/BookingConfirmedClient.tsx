"use client";

import { useEffect, useState } from "react";

type ConfirmMeta = {
  reviewUrl: string | null;
  googleCalendarUrl: string | null;
  icsUrl: string | null;
};

export default function BookingConfirmed({ bookingId }: { bookingId: string }) {
  const [meta, setMeta] = useState<ConfirmMeta>({
    reviewUrl: null,
    googleCalendarUrl: null,
    icsUrl: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/bookings/confirm-meta?id=${bookingId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setMeta({
            reviewUrl: data.reviewUrl ?? null,
            googleCalendarUrl: data.googleCalendarUrl ?? null,
            icsUrl: data.icsUrl ?? null,
          });
        }
      } catch {
        // optional
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const hasCalendar = Boolean(meta.googleCalendarUrl || meta.icsUrl);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-2xl font-semibold text-green-600">
        ✔ Programare confirmată
      </h1>

      <p className="mt-2 text-gray-600">Am trimis un email de confirmare.</p>

      <p className="text-sm text-gray-400">Verifică inbox / spam.</p>

      {hasCalendar && (
        <div className="mt-8 flex flex-col sm:flex-row gap-3 items-center">
          {meta.googleCalendarUrl && (
            <a
              href={meta.googleCalendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-[#1a73e8] text-white px-5 py-3 rounded-xl text-sm font-medium"
            >
              Adaugă în Google Calendar
            </a>
          )}
          {meta.icsUrl && (
            <a
              href={meta.icsUrl}
              className="inline-block bg-black text-white px-5 py-3 rounded-xl text-sm font-medium"
            >
              Descarcă pentru Apple / Outlook
            </a>
          )}
        </div>
      )}

      {meta.reviewUrl && (
        <a
          href={meta.reviewUrl}
          className="mt-6 inline-block border border-gray-300 text-gray-800 px-5 py-3 rounded-xl text-sm font-medium"
        >
          Lasă o recenzie
        </a>
      )}
    </div>
  );
}
