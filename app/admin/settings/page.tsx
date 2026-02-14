"use client";

import WeeklyScheduleEditor from "./components/WeeklyScheduleEditor";

export default function AdminSettingsPage() {
  // TODO: înlocuiește cu barber-ul logat din session / context
  const barberId = "CURRENT_BARBER_ID";

  return (
    <div style={{ padding: 20, maxWidth: 800 }}>
      <h1>Setări</h1>

      <section style={{ marginTop: 24 }}>
        <h2>Program săptămânal</h2>

        <WeeklyScheduleEditor barberId={barberId} />
      </section>
    </div>
  );
}
