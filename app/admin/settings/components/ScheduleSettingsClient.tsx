"use client";

import { useState } from "react";
import type { ScheduleMode } from "@/lib/schedule/resolveDaySchedule";
import ScheduleModePicker from "./ScheduleModePicker";
import WeeklyScheduleEditor from "./WeeklyScheduleEditor";
import OverrideManager from "./OverrideManager";

type Day = {
  day_of_week: number;
  is_working: boolean;
  work_start: string | null;
  work_end: string | null;
  break_enabled: boolean;
  break_start: string | null;
  break_end: string | null;
};

export default function ScheduleSettingsClient({
  barberId,
  initialMode,
  initialWeekly,
  initialOverrides,
}: {
  barberId: string;
  initialMode: ScheduleMode;
  initialWeekly: Day[];
  initialOverrides: unknown[];
}) {
  const [mode, setMode] = useState<ScheduleMode>(initialMode);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-4">Program de lucru</h1>
        <ScheduleModePicker
          barberId={barberId}
          initialMode={initialMode}
          onModeChange={setMode}
        />
      </div>

      {mode === "weekly" ? (
        <WeeklyScheduleEditor initialData={initialWeekly} />
      ) : (
        <div className="rounded-xl border border-dashed border-frz-line px-4 py-3 text-sm text-frz-ink/50">
          Programul săptămânal este păstrat, dar nu se aplică cât timp ești pe
          modul selectiv. Poți reveni oricând la săptămânal.
        </div>
      )}

      <OverrideManager
        barberId={barberId}
        initialOverrides={initialOverrides as never[]}
        scheduleMode={mode}
      />
    </div>
  );
}
