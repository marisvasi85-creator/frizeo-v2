import OverridesCalendar from "./OverridesCalendar";

export default function OverridesPage() {
  const barberId = "11111111-1111-1111-1111-111111111111";

  return (
    <div>
      <h1>Override zile</h1>
      <OverridesCalendar barberId={barberId} />
    </div>
  );
}