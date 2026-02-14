"use client";

import { useState } from "react";
import {
  createService,
  deleteService,
  toggleServiceActive,
} from "./actions";

export default function ServicesClient({ services }: { services: any[] }) {
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <h1>Servicii</h1>

      {/* CREATE SERVICE */}
      <form
        action={async (formData) => {
          setError(null);
          setLoadingCreate(true);

          const duration = Number(formData.get("duration"));
          const price = Number(formData.get("price"));

          if (duration <= 0) {
            setError("Durata trebuie să fie mai mare decât 0.");
            setLoadingCreate(false);
            return;
          }

          if (!isNaN(price) && price < 0) {
            setError("Prețul nu poate fi negativ.");
            setLoadingCreate(false);
            return;
          }

          try {
            await createService(formData);
          } catch {
            setError("Eroare la salvarea serviciului.");
          } finally {
            setLoadingCreate(false);
          }
        }}
        style={{ marginBottom: 24 }}
      >
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input name="name" placeholder="Nume serviciu" required />

          <input
            name="duration"
            type="number"
            placeholder="Durată (min)"
            min={1}
            required
          />

          <input
            name="price"
            type="number"
            placeholder="Preț"
            min={0}
          />

          <button type="submit" disabled={loadingCreate}>
            {loadingCreate ? "Se salvează..." : "Adaugă"}
          </button>
        </div>

        {error && (
          <div style={{ color: "red", fontSize: 14 }}>{error}</div>
        )}
      </form>

      {/* SERVICES LIST */}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {services.map((s) => (
          <li
            key={s.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 0",
              borderBottom: "1px solid #eee",
              opacity: s.active ? 1 : 0.5,
            }}
          >
            {/* INFO */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <strong>{s.name}</strong>

              {/* STATUS BADGE */}
              <span
                style={{
                  fontSize: 12,
                  padding: "2px 6px",
                  borderRadius: 6,
                  background: s.active ? "#e6f7ec" : "#eee",
                  color: s.active ? "#1a7f37" : "#555",
                  fontWeight: 500,
                }}
              >
                {s.active ? "Activ" : "Inactiv"}
              </span>

              <span>
                – {s.duration_minutes} min – {s.price ?? "-"} RON
              </span>
            </div>

            {/* ACTIONS */}
            <div style={{ display: "flex", gap: 8 }}>
              {/* ON / OFF */}
              <button
                onClick={async () => {
                  setTogglingId(s.id);
                  try {
                    await toggleServiceActive(s.id, !s.active);
                  } finally {
                    setTogglingId(null);
                  }
                }}
                disabled={togglingId === s.id}
              >
                {togglingId === s.id
                  ? "..."
                  : s.active
                  ? "Dezactivează"
                  : "Activează"}
              </button>

              {/* DELETE */}
              <button
                onClick={async () => {
                  const ok = confirm(
                    `Sigur vrei să ștergi serviciul „${s.name}”?`
                  );
                  if (!ok) return;

                  setDeletingId(s.id);
                  try {
                    await deleteService(s.id);
                  } finally {
                    setDeletingId(null);
                  }
                }}
                disabled={deletingId === s.id}
              >
                {deletingId === s.id ? "Ștergere..." : "Șterge"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
