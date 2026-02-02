"use client";

import { useEffect, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import {
  addMonths,
  format,
  isSameDay,
  parseISO,
} from "date-fns";

type Props = {
  barberId: string;
  date: string | null;
  onChange: (date: string) => void;
  disabled?: boolean;
};

export default function Calendar({
  barberId,
  date,
  onChange,
  disabled,
}: Props) {
  const [daysWithSlots, setDaysWithSlots] = useState<Date[]>([]);
  const [loading, setLoading] = useState(false);

  const today = new Date();
  const maxDate = addMonths(today, 3);

  useEffect(() => {
    async function loadAvailability() {
      if (!barberId) return;

      setLoading(true);

      const from = format(today, "yyyy-MM-dd");
      const to = format(maxDate, "yyyy-MM-dd");

      const res = await fetch(
        `/api/availability?barberId=${barberId}&from=${from}&to=${to}`
      );

      const data = await res.json();

      if (res.ok && Array.isArray(data.daysWithSlots)) {
        setDaysWithSlots(
          data.daysWithSlots.map((d: string) => parseISO(d))
        );
      }

      setLoading(false);
    }

    loadAvailability();
  }, [barberId]);

  return (
    <div className="border rounded p-3 bg-white">
      {loading && (
        <p className="text-sm text-gray-500 mb-2">
          Se încarcă disponibilitatea…
        </p>
      )}

      <DayPicker
        mode="single"
        selected={date ? parseISO(date) : undefined}
        onSelect={(day) => {
          if (!day) return;
          onChange(format(day, "yyyy-MM-dd"));
        }}
        disabled={[
          { before: today },
          { after: maxDate },
          (day) =>
            !daysWithSlots.some((d) => isSameDay(d, day)),
        ]}
        modifiers={{
          hasSlots: daysWithSlots,
        }}
        modifiersClassNames={{
          hasSlots:
            "bg-green-100 text-green-900 font-semibold",
        }}
      />
    </div>
  );
}
