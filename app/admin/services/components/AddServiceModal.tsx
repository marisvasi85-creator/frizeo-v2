"use client";

import { useState } from "react";
import AdminModal from "../../components/AdminModal";
import AdminButton from "../../components/AdminButton";
import { AdminInput, AdminSelect } from "../../components/AdminInput";

export default function AddServiceModal({
  barberId,
  service,
  onClose,
  onCreated,
}: any) {
  const [name, setName] = useState(service?.display_name || "");
  const [price, setPrice] = useState(service?.price ?? "");
  const [duration, setDuration] = useState<string>(
    service?.duration?.toString() || ""
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!name || !duration) {
      alert("Completează nume și durată");
      return;
    }

    setLoading(true);

    const url = service ? "/api/services/update" : "/api/services/create";

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: service?.id,
        barber_id: barberId,
        name: name.toLowerCase().replace(/\s+/g, "_"),
        display_name: name,
        price: price ? Number(price) : null,
        duration: Number(duration),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Eroare");
      setLoading(false);
      return;
    }

    onCreated(data);
  }

  return (
    <AdminModal
      onClose={onClose}
      maxWidth="max-w-sm"
      title={service ? "Editează serviciu" : "Adaugă serviciu"}
    >
      <AdminInput
        placeholder="Nume serviciu"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <AdminSelect
        value={duration}
        onChange={(e) => setDuration(e.target.value)}
      >
        <option value="">Alege durata</option>
        <option value="15">15 min</option>
        <option value="30">30 min</option>
        <option value="45">45 min</option>
        <option value="60">60 min</option>
        <option value="75">75 min</option>
        <option value="90">90 min</option>
        <option value="120">120 min</option>
      </AdminSelect>

      <AdminInput
        placeholder="Preț (opțional)"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />

      <div className="flex gap-2">
        <AdminButton
          variant="secondary"
          fullWidth
          onClick={onClose}
          className="py-3"
        >
          Anulează
        </AdminButton>

        <AdminButton
          fullWidth
          loading={loading}
          loadingLabel="Se salvează..."
          onClick={handleSubmit}
          className="py-3"
        >
          Salvează
        </AdminButton>
      </div>
    </AdminModal>
  );
}
