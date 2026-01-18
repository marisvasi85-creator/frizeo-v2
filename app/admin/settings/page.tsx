"use client";

import { useEffect, useState } from "react";

/* ================= TYPES ================= */

type BarberSettings = {
  slot_duration_minutes: number;
  break_between_minutes: number;
  cancel_limit_hours: number;
};

/* ================= PAGE ================= */

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<BarberSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* ================= FETCH SETTINGS ================= */

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/admin/settings");

        if (!res.ok) {
          throw new Error("Nu s-au putut încărca setările");
        }

        const data = await res.json();
        setSettings({
          slot_duration_minutes: data.slot_duration_minutes,
          break_between_minutes: data.break_between_minutes,
          cancel_limit_hours: data.cancel_limit_hours,
        });
      } catch (err) {
        setError("Eroare la încărcarea setărilor");
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  /* ================= SAVE SETTINGS ================= */

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        throw new Error("Eroare la salvare");
      }

      setMessage("Setările au fost salvate cu succes");
    } catch (err) {
      setError("Nu s-au putut salva setările");
    } finally {
      setSaving(false);
    }
  };

  /* ================= RENDER ================= */

  if (loading) {
    return <p>Se încarcă setările...</p>;
  }

  if (error) {
    return <p style={{ color: "red" }}>{error}</p>;
  }

  if (!settings) {
    return <p>Nu există setări disponibile.</p>;
  }

  return (
    <div style={{ maxWidth: 420 }}>
      <h1>Setări frizer</h1>

      <label style={{ display: "block", marginBottom: 12 }}>
        Durata programare (minute)
        <input
          type="number"
          value={settings.slot_duration_minutes}
          onChange={(e) =>
            setSettings({
              ...settings,
              slot_duration_minutes: Number(e.target.value),
            })
          }
        />
      </label>

      <label style={{ display: "block", marginBottom: 12 }}>
        Pauză între programări (minute)
        <input
          type="number"
          value={settings.break_between_minutes}
          onChange={(e) =>
            setSettings({
              ...settings,
              break_between_minutes: Number(e.target.value),
            })
          }
        />
      </label>

      <label style={{ display: "block", marginBottom: 12 }}>
        Limită anulare (ore)
        <input
          type="number"
          value={settings.cancel_limit_hours}
          onChange={(e) =>
            setSettings({
              ...settings,
              cancel_limit_hours: Number(e.target.value),
            })
          }
        />
      </label>

      <button onClick={handleSave} disabled={saving}>
        {saving ? "Se salvează..." : "Salvează"}
      </button>

      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
