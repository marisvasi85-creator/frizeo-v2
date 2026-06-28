"use client";

import { useState } from "react";
import AddServiceModal from "./components/AddServiceModal";
import AdminButton from "../components/AdminButton";
import AdminCard from "../components/AdminCard";
import EmptyState from "../components/EmptyState";

export default function ServicesClient({
  services,
  barberId,
}: {
  services: any[];
  barberId: string;
}) {
  const [items, setItems] = useState(services || []);
  const [openAdd, setOpenAdd] = useState(false);
  const [editingService, setEditingService] = useState<any | null>(null);

  // 🔥 DELETE
  async function handleDelete(id: string) {
    if (!confirm("Ștergi serviciul?")) return;

    const res = await fetch("/api/services/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Eroare la ștergere");
      return;
    }

    setItems((prev) => prev.filter((s) => s.id !== id));
  }

  // 🔥 TOGGLE
  async function toggleActive(id: string, current: boolean) {
    const res = await fetch("/api/services/toggle", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id,
        active: !current,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Eroare toggle");
      return;
    }

    const data = await res.json();

    setItems((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, active: data.service.active } : s
      )
    );
  }

  return (
  <div className="w-full space-y-6">

    {/* HEADER */}
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <h1 className="text-2xl font-semibold">
        Servicii
      </h1>

      <AdminButton onClick={() => setOpenAdd(true)} className="w-full sm:w-auto">
        + Adaugă
      </AdminButton>
    </div>

    {/* LIST */}
    <div className="space-y-4">

      {items.map((s) => (
        <AdminCard key={s.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

          {/* LEFT */}
          <div>
            <div className="font-semibold text-lg">
              {s.display_name || s.name}
            </div>

            <div className="text-sm text-white/50 mt-1">
              {s.duration} min
            </div>
          </div>

          {/* RIGHT */}
          <div className="flex flex-wrap items-center gap-3">

            <span className="text-white/70 font-medium">
              {s.price ? `${s.price} lei` : "—"}
            </span>

            <button
              onClick={() => toggleActive(s.id, s.active)}
              className={`relative w-10 h-5 rounded-full transition ${
                s.active
                  ? "bg-green-500"
                  : "bg-zinc-600"
              }`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition ${
                  s.active
                    ? "translate-x-5"
                    : ""
                }`}
              />
            </button>

            <button
              onClick={() => setEditingService(s)}
              className="
                px-3
                py-1.5
                rounded-lg
                bg-blue-500/15
                text-blue-400
                text-sm
              "
            >
              Edit
            </button>

            <button
              onClick={() => handleDelete(s.id)}
              className="
                px-3
                py-1.5
                rounded-lg
                bg-red-500/15
                text-red-400
                text-sm
              "
            >
              Șterge
            </button>

          </div>
        </AdminCard>
      ))}

      {items.length === 0 && (
        <EmptyState>Nu există servicii.</EmptyState>
      )}

    </div>

    {/* ADD */}
    {openAdd && (
      <AddServiceModal
        barberId={barberId}
        onClose={() => setOpenAdd(false)}
        onCreated={(newService: any) => {
          setOpenAdd(false);

          const service =
            newService.service || newService;

          setItems((prev) => [
            ...prev,
            service,
          ]);
        }}
      />
    )}

    {/* EDIT */}
    {editingService && (
      <AddServiceModal
        service={editingService}
        barberId={barberId}
        onClose={() =>
          setEditingService(null)
        }
        onCreated={(updated: any) => {
          setEditingService(null);

          const service =
            updated.service || updated;

          setItems((prev) =>
            prev.map((s) =>
              s.id === service.id
                ? service
                : s
            )
          );
        }}
      />
    )}

  </div>
);}