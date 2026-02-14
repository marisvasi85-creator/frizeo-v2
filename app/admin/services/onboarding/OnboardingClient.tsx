"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getServicesForOnboarding,
  onboardServices,
} from "./actions";

type Service = {
  id: string;
  name: string;
  price: number | null;
};


export default function OnboardingClient() {
  const [services, setServices] = useState<Service[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* 🔹 load services via Server Action (RLS-safe) */
  useEffect(() => {
    getServicesForOnboarding()
      .then((data) => {
        setServices(data ?? []);
      })
      .catch(() => {
        setError("Nu s-au putut încărca serviciile.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (selected.size === 0) {
      setError("Selectează cel puțin un serviciu.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onboardServices({
        serviceIds: Array.from(selected),
      });
    } catch {
      setError("Eroare la activarea serviciilor.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p>Se încarcă serviciile…</p>;
  }

  if (error) {
    return <div style={{ color: "red" }}>{error}</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1>Activare servicii pentru barber</h1>
        <p style={{ color: "#555", maxWidth: 700 }}>
          Selectează serviciile care vor fi disponibile pentru acest barber.
          Acestea vor fi folosite în sistemul de programări.
        </p>
      </div>

      {/* LIST */}
      <div
        style={{
          border: "1px solid #eee",
          borderRadius: 8,
          padding: 16,
        }}
      >
        {services.length === 0 && (
          <p style={{ color: "#777" }}>
            Nu există servicii disponibile.
          </p>
        )}

        {services.map((s) => (
  <label
    key={s.id}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "8px 0",
    }}
  >
    <input
      type="checkbox"
      checked={selected.has(s.id)}
      onChange={() => toggle(s.id)}
    />

    <div>
      <strong>{s.name}</strong>{" "}
      <span style={{ color: "#555" }}>
        – {s.price ?? "-"} RON
      </span>
    </div>
  </label>
))}

      </div>

      {/* ACTIONS */}
      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={submit} disabled={submitting}>
          {submitting ? "Se activează..." : "Activează serviciile"}
        </button>

        <Link href="/admin/services">
          Anulează
        </Link>
      </div>
    </div>
  );
}
