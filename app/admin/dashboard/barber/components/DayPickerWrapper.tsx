"use client";

import { useState } from "react";
import DayPicker from "./DayPicker";
import BookingList from "./BookingList";

export default function DayPickerWrapper({
  barberId,
}: {
  barberId: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);

  return (
    <>
      <DayPicker value={date} onChange={setDate} />
      <BookingList barberId={barberId} date={date} />
    </>
  );
}
