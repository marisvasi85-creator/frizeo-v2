"use client";

import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { CalendarDays } from "lucide-react";

type Override = {
  id: string;
  date: string;
  is_closed: boolean;
};

export default function OverrideManager({
  barberId,
}: {
  barberId: string;
}) {
  const [date, setDate] = useState("");
  const [selectedDate, setSelectedDate] =
  useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  const [overrides, setOverrides] = useState<Override[]>([]);

  async function loadOverrides() {
    const res = await fetch(
      `/api/barber-overrides?barberId=${barberId}`
    );

    const data = await res.json();

    setOverrides(data.overrides || []);
  }

  useEffect(() => {
    loadOverrides();
  }, [barberId]);

  async function addOverride() {
    if (!date) return;

    setLoading(true);

    const res = await fetch("/api/barber-overrides", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        barber_id: barberId,
        date,
        is_closed: true,
      }),
    });

    if (res.ok) {
      setDate("");
      loadOverrides();
    }

    setLoading(false);
  }

  async function deleteOverride(date: string) {
    const ok = confirm(
      "Ștergi această zi specială?"
    );

    if (!ok) return;

    const res = await fetch(
      `/api/barber-overrides?barberId=${barberId}&date=${date}`,
      {
        method: "DELETE",
      }
    );

    if (res.ok) {
  setDate("");
  setSelectedDate(null);
  loadOverrides();
}

}

return (
  <div className="space-y-6">

    <div>
      <h2 className="text-lg font-semibold">
        Zile speciale
      </h2>

      <p className="text-sm text-white/60 mt-1">
        Marchează concedii, sărbători sau zile în care
        salonul este închis.
      </p>
    </div>

    <div className="bg-[#161618] border border-white/10 p-4 rounded-xl space-y-4">

      <div className="flex flex-col md:flex-row gap-3">

        <div className="relative w-full">

          <DatePicker
            selected={selectedDate}
            onChange={(date: Date | null) => {
              setSelectedDate(date);

              if (date) {
                const formatted =
                  date.toISOString().split("T")[0];

                setDate(formatted);
              }
            }}
            dateFormat="dd.MM.yyyy"
            placeholderText="Selectează data"
            className="
              w-full
              bg-[#0F0F10]
              text-white
              border
              border-white/10
              px-4
              py-3
              pr-12
              rounded-lg
            "
          />

          <CalendarDays
            size={18}
            className="
              absolute
              right-4
              top-1/2
              -translate-y-1/2
              text-white/50
              pointer-events-none
            "
          />

        </div>

        <button
          onClick={addOverride}
          disabled={!date || loading}
          className="
            w-full
            md:w-auto
            bg-white
            text-black
            px-4
            py-3
            rounded-lg
            font-medium
            disabled:opacity-50
          "
        >
          {loading
            ? "Se salvează..."
            : "Adaugă zi liberă"}
        </button>

      </div>

    </div>

    <div className="space-y-3">

      {overrides.length === 0 && (
        <div className="text-white/50 text-sm">
          Nu există zile speciale.
        </div>
      )}

      {overrides
        .sort((a, b) =>
          a.date.localeCompare(b.date)
        )
        .map((item) => (
          <div
            key={item.id}
            className="bg-[#161618] border border-white/10 p-4 rounded-xl flex justify-between items-center"
          >
            <div>
              <div className="font-medium">
                {new Date(item.date).toLocaleDateString(
                  "ro-RO"
                )}
              </div>

              <div className="text-sm text-red-400">
                Zi liberă
              </div>
            </div>

            <button
              onClick={() =>
                deleteOverride(item.date)
              }
              className="text-red-400 hover:text-red-300"
            >
              Șterge
            </button>
          </div>
        ))}

    </div>

  </div>
);}