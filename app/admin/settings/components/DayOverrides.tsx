"use client";

import DayOverrideForm from "./DayOverrideForm";
import OverrideList from "./OverrideList";

export default function DayOverrides() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Zile speciale</h2>

      <DayOverrideForm />

      <OverrideList />
    </div>
  );
}