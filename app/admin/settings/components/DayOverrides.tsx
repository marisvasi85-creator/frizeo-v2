"use client";

import DayOverrideForm from "./DayOverrideForm";
import OverrideList from "./OverrideList";

export default function DayOverrides() {
  return (
    <div>
      <h2>📅 Zile speciale (Overrides)</h2>

      <p style={{ fontSize: 14, opacity: 0.8 }}>
        Aici poți închide o zi, modifica programul sau pauza doar pentru o
        anumită dată.
      </p>

      <DayOverrideForm />

      <hr style={{ margin: "24px 0" }} />

      <OverrideList />
    </div>
  );
}
