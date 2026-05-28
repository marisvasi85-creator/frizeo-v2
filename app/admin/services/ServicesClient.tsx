"use client";

import { useState } from "react";
import AddServiceModal from "./components/AddServiceModal";

export default function ServicesClient({
  services,
  barberId,
}: {
  services: any[];
  barberId: string;
}) {
  const [items, setItems] = useState(services);
  const [openAdd, setOpenAdd] = useState(false);
  const [editingService, setEditingService] = useState<any | null>(null);

  // 🔥 DELETE
  async function handleDelete(id: string) {
    if (!confirm("Ștergi serviciul?")) return;

    const res = await fetch("/api/services/delete", {
      method: "POST",
      body: JSON.stringify({ id }),
    });

    if (!res.ok) {
      alert("Eroare la ștergere");
      return;
    }

    setItems((prev) => prev.filter((s) => s.id !== id));
  }

  // 🔥 TOGGLE ACTIVE
  async function toggleActive(id: string, current: boolean) {
    const res = await fetch("/api/services/toggle", {
      method: "POST",
      body: JSON.stringify({
        id,
        active: !current,
      }),
    });

    if (!res.ok) {
      alert("Eroare toggle");
      return;
    }

    const updated = await res.json();

    setItems((prev) =>
      prev.map((s) => (s.id === id ? updated : s))
    );
  }

  return (
    <div className="max-w-2xl space-y-6">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Servicii</h1>

        <button
          onClick={() => setOpenAdd(true)}
          className="bg-white text-black px-4 py-2 rounded"
        >
          + Adaugă
        </button>
      </div>

      {/* LIST */}
      <div className="space-y-3">
        {items.map((s) => (
          <div
            key={s.id}
            className="p-4 rounded-xl bg-[#0F0F10] flex justify-between items-center"
          >
            <div>
              <div className="font-medium">
                {s.display_name || s.name}
              </div>

              <div className="text-xs text-white/50">
                {s.duration} min
              </div>
            </div>

            {/* ACTIONS */}
            <div className="flex items-center gap-4">

              {/* PREȚ */}
              <span className="text-white/60">
                {s.price ? `${s.price} lei` : "—"}
              </span>

              {/* 🔥 TOGGLE SWITCH */}
              <button
                onClick={() => toggleActive(s.id, s.active)}
                className={`relative w-10 h-5 rounded-full transition ${
                  s.active ? "bg-green-500" : "bg-zinc-600"
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition ${
                    s.active ? "translate-x-5" : ""
                  }`}
                />
              </button>

              {/* EDIT */}
              <button
                onClick={() => setEditingService(s)}
                className="text-blue-400 text-sm"
              >
                Edit
              </button>

              {/* DELETE */}
              <button
                onClick={() => handleDelete(s.id)}
                className="text-red-500 text-sm"
              >
                Șterge
              </button>

            </div>
          </div>
        ))}

        {items.length === 0 && (
          <p className="text-white/60">Nu există servicii.</p>
        )}
      </div>

      {/* ADD */}
      {openAdd && (
        <AddServiceModal
          barberId={barberId}
          onClose={() => setOpenAdd(false)}
          onCreated={(newService: any) => {
            setOpenAdd(false);
            setItems((prev) => [...prev, newService]);
          }}
        />
      )}

      {/* EDIT */}
      {editingService && (
        <AddServiceModal
          service={editingService}
          barberId={barberId}
          onClose={() => setEditingService(null)}
          onCreated={(updated: any) => {
            setEditingService(null);
            setItems((prev) =>
              prev.map((s) => (s.id === updated.id ? updated : s))
            );
          }}
        />
      )}
    </div>
  );
}