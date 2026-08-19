"use client";

import { useEffect, useState } from "react";

type ConfirmMeta = {
  reviewUrl: string | null;
  googleCalendarUrl: string | null;
  icsUrl: string | null;
};

export default function BookingConfirmed({
  bookingId,
  cancelToken,
}: {
  bookingId: string;
  cancelToken?: string | null;
}) {
  const [meta, setMeta] = useState<ConfirmMeta>({
    reviewUrl: null,
    googleCalendarUrl: null,
    icsUrl: null,
  });

  useEffect(() => {
    if (!cancelToken) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/bookings/confirm-meta?id=${encodeURIComponent(bookingId)}&t=${encodeURIComponent(cancelToken)}`,
        );
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
  }, [bookingId, cancelToken]);

  const hasCalendar = Boolean(meta.googleCalendarUrl || meta.icsUrl);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-2xl font-semibold text-frz-success">
        ✔ Programare confirmată
      </h1>

      <p className="mt-2 text-frz-muted">Am trimis un email de confirmare.</p>

      <p className="text-sm text-frz-muted">Verifică inbox / spam.</p>

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
              className="inline-block bg-frz-ink text-frz-ink-contrast px-5 py-3 rounded-xl text-sm font-medium"
            >
              Descarcă pentru Apple / Outlook
            </a>
          )}
        </div>
      )}

      {meta.reviewUrl && (
        <a
          href={meta.reviewUrl}
          className="mt-6 inline-block border border-frz-line text-frz-ink px-5 py-3 rounded-xl text-sm font-medium"
        >
          Lasă o recenzie
        </a>
      )}
    </div>
  );
}
