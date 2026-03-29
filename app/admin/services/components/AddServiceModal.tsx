"use client";

import { useState, useTransition } from "react";
import { createService } from "../actions";

export default function AddServiceModal() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [duration, setDuration] = useState("");
  const [price, setPrice] = useState("");

  function handleSubmit() {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("duration", duration);
      formData.append("price", price);

      await createService(formData);

      // reset
      setName("");
      setDuration("");
      setPrice("");
      setOpen(false);
    });
  }

  return (
    <>
      {/* BUTTON */}
      <button
        onClick={() => setOpen(true)}
        className="bg-white text-black px-4 py-2 rounded-lg text-sm hover:opacity-90"
      >
        + Adaugă serviciu
      </button>

      {/* MODAL */}
      {open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">

          <div className="bg-[#161618] p-6 rounded-xl w-full max-w-md space-y-4 border border-white/10">

            <h2 className="text-lg font-semibold">
              Adaugă serviciu
            </h2>

            <input
              placeholder="Nume serviciu"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#0F0F10] border border-white/10 px-3 py-2 rounded text-sm"
            />

            <input
              type="number"
              placeholder="Durată (minute)"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full bg-[#0F0F10] border border-white/10 px-3 py-2 rounded text-sm"
            />

            <input
              type="number"
              placeholder="Preț"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full bg-[#0F0F10] border border-white/10 px-3 py-2 rounded text-sm"
            />

            {/* ACTIONS */}
            <div className="flex justify-end gap-2 pt-2">

              <button
                onClick={() => setOpen(false)}
                className="px-3 py-2 text-sm text-white/60 hover:text-white"
              >
                Anulează
              </button>

              <button
                onClick={handleSubmit}
                disabled={pending || !name || !duration}
                className="bg-white text-black px-4 py-2 rounded text-sm disabled:opacity-50"
              >
                Salvează
              </button>

            </div>

          </div>
        </div>
      )}
    </>
  );
}