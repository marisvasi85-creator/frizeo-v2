"use client";

import { useEffect, useState } from "react";

type Props = {
  barberId: string;
  date: string; // YYYY-MM-DD
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

  /* =========================
     LOAD EXISTING OVERRIDE
  ========================= */
  useEffect(() => {
    setLoading(true);

    fetch(
      `/api/barber-overrides?barberId=${barberId}&date=${date}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setIsClosed(data.is_closed ?? false);
          setWorkStart(data.work_start ?? "");
          setWorkEnd(data.work_end ?? "");
          setBreakEnabled(data.break_enabled ?? false);
          setBreakStart(data.break_start ?? "");
          setBreakEnd(data.break_end ?? "");
          setSlotDuration(
            data.slot_duration ? String(data.slot_duration) : ""
          );
        }
      })
      .finally(() => setLoading(false));
  }, [barberId, date]);

  /* =========================
     SAVE OVERRIDE
  ========================= */
  async function save() {
    setLoading(true);

    const payload = {
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
    };

    const res = await fetch("/api/barber-overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      alert("Eroare la salvare override");
      return;
    }

    onSaved?.();
    onClose();
  }

  /* =========================
     DELETE OVERRIDE
  ========================= */
  async function remove() {
    if (!confirm("Ștergi override-ul pentru această zi?")) return;

    setLoading(true);

    const res = await fetch(
      `/api/barber-overrides?barberId=${barberId}&date=${date}`,
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

  /* =========================
     RENDER
  ========================= */
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: 20,
          borderRadius: 8,
          width: 360,
        }}
      >
        <h3>Override {date}</h3>

        {loading && <p>Se încarcă…</p>}

        {!loading && (
          <>
            <label>
              <input
                type="checkbox"
                checked={isClosed}
                onChange={(e) =>
                  setIsClosed(e.target.checked)
                }
              />{" "}
              Zi închisă
            </label>

            {!isClosed && (
              <>
                <hr />

                <label>
                  Start:
                  <input
                    type="time"
                    value={workStart}
                    onChange={(e) =>
                      setWorkStart(e.target.value)
                    }
                  />
                </label>

                <label>
                  End:
                  <input
                    type="time"
                    value={workEnd}
                    onChange={(e) =>
                      setWorkEnd(e.target.value)
                    }
                  />
                </label>

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
                    <label>
                      Pauză start:
                      <input
                        type="time"
                        value={breakStart}
                        onChange={(e) =>
                          setBreakStart(e.target.value)
                        }
                      />
                    </label>

                    <label>
                      Pauză end:
                      <input
                        type="time"
                        value={breakEnd}
                        onChange={(e) =>
                          setBreakEnd(e.target.value)
                        }
                      />
                    </label>
                  </>
                )}

                <label>
                  Durată slot (min):
                  <input
                    type="number"
                    value={slotDuration}
                    onChange={(e) =>
                      setSlotDuration(e.target.value)
                    }
                    placeholder="ex: 20"
                  />
                </label>
              </>
            )}

            <hr />

            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "space-between",
              }}
            >
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
