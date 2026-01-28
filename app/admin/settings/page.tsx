import WeeklyScheduleEditor from "./components/WeeklyScheduleEditor";
import DayOverrides from "./components/DayOverrides";

export default function SettingsPage() {
  return (
    <div>
      <WeeklyScheduleEditor />

      <hr style={{ margin: "40px 0" }} />


      {/* OVERRIDES */}
      <DayOverrides />
    </div>
  );
}
