"use client";

import { useEffect, useState } from "react";

type Props = {
  barberId: string;
  date: string;
  onClose: () => void;
  onSaved?: () => void;
};

export default function OverrideModal({
  barberId,
  date,
  onClose,
  onSaved,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [isClosed, setIsClosed] = useState(false);

  const [workStart, setWorkStart] = useState("");
  const [workEnd, setWorkEnd] = useState("");

  const [breakEnabled, setBreakEnabled] = useState(false);
  const [breakStart, setBreakStart] = useState("");
  const [breakEnd, setBreakEnd] = useState("");

  const [slotDuration, setSlotDuration] = useState("");

  useEffect(() => {
    setLoading(true);

    fetch(
      `/api/barber-day-overrides?barberId=${barberId}&date=${date}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (!data) return;

        setIsClosed(data.is_closed ?? false);
        setWorkStart(data.work_start ?? "");
        setWorkEnd(data.work_end ?? "");
        setBreakEnabled(data.break_enabled ?? false);
        setBreakStart(data.break_start ?? "");
        setBreakEnd(data.break_end ?? "");
        setSlotDuration(
          data.slot_duration != null
            ? String(data.slot_duration)
            : ""
        );
      })
      .finally(() => setLoading(false));
  }, [barberId, date]);

  async function save() {
    if (!isClosed && (!workStart || !workEnd)) {
      alert("Programul zilei este incomplet");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/barber-day-overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barber_id: barberId,
        date,
        is_closed: isClosed,
        work_start: isClosed ? null : workStart || null,
        work_end: isClosed ? null : workEnd || null,
        break_enabled: isClosed ? false : breakEnabled,
        break_start:
          isClosed || !breakEnabled ? null : breakStart || null,
        break_end:
          isClosed || !breakEnabled ? null : breakEnd || null,
        slot_duration:
          isClosed || !slotDuration ? null : Number(slotDuration),
      }),
    });

    setLoading(false);

    if (!res.ok) {
      alert("Eroare la salvare");
      return;
    }

    onSaved?.(); // 🔥 refresh calendar
    onClose();
  }

  async function remove() {
    if (!confirm("Ștergi override-ul?")) return;

    setLoading(true);

    const res = await fetch(
      `/api/barber-day-overrides?barberId=${barberId}&date=${date}`,
      { method: "DELETE" }
    );

    setLoading(false);

    if (!res.ok) {
      alert("Eroare la ștergere");
      return;
    }

    onSaved?.();
    onClose();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: 20,
          borderRadius: 10,
          width: 360,
        }}
      >
        <h3 style={{ marginBottom: 10 }}>
          Override {date}
        </h3>

        {loading && <p>Se încarcă...</p>}

        {!loading && (
          <>
            <label>
              <input
                type="checkbox"
                checked={isClosed}
                onChange={(e) => setIsClosed(e.target.checked)}
              />{" "}
              Zi închisă
            </label>

            {!isClosed && (
              <>
                <hr />

                <input
                  type="time"
                  value={workStart}
                  onChange={(e) => setWorkStart(e.target.value)}
                />
                <input
                  type="time"
                  value={workEnd}
                  onChange={(e) => setWorkEnd(e.target.value)}
                />

                <label>
                  <input
                    type="checkbox"
                    checked={breakEnabled}
                    onChange={(e) =>
                      setBreakEnabled(e.target.checked)
                    }
                  />{" "}
                  Pauză
                </label>

                {breakEnabled && (
                  <>
                    <input
                      type="time"
                      value={breakStart}
                      onChange={(e) =>
                        setBreakStart(e.target.value)
                      }
                    />
                    <input
                      type="time"
                      value={breakEnd}
                      onChange={(e) =>
                        setBreakEnd(e.target.value)
                      }
                    />
                  </>
                )}

                <input
                  type="number"
                  placeholder="Durată slot"
                  value={slotDuration}
                  onChange={(e) =>
                    setSlotDuration(e.target.value)
                  }
                />
              </>
            )}

            <hr />

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={save}>Salvează</button>
              <button onClick={remove}>Șterge</button>
              <button onClick={onClose}>Închide</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}