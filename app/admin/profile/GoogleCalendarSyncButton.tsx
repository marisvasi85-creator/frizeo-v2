"use client";

import { useState } from "react";
import AdminButton from "../../components/AdminButton";

export default function GoogleCalendarSyncButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function syncBookings() {
    setLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const res = await fetch("/api/google/sync-bookings", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setIsError(true);
        setMessage(data.error || "Nu s-a putut sincroniza.");
        return;
      }

      if (data.synced === 0 && data.failed === 0) {
        setMessage(
          "Nu există programări viitoare de sincronizat (sau sunt deja în Calendar).",
        );
        return;
      }

      if (data.failed > 0) {
        setIsError(true);
        setMessage(
          `Sincronizate: ${data.synced}. Eșuate: ${data.failed}. Încearcă reconectarea sau contactează suportul.`,
        );
        return;
      }

      setMessage(
        `${data.synced} programări au fost adăugate în Google Calendar.`,
      );
    } catch {
      setIsError(true);
      setMessage("Eroare de rețea. Încearcă din nou.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <AdminButton
        variant="secondary"
        onClick={syncBookings}
        loading={loading}
        loadingLabel="Se sincronizează..."
      >
        Sincronizează programările existente
      </AdminButton>

      {message && (
        <p className={`text-sm ${isError ? "text-red-400" : "text-green-400"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
