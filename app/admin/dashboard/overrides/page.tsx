import OverridesCalendar from "./OverridesCalendar";

export default function OverridesPage() {
  const barberId = "11111111-1111-1111-1111-111111111111";
  const tenantId = "22222222-2222-2222-2222-222222222222";

  return (
    <OverridesCalendar
      barberId={barberId}
      tenantId={tenantId}
    />
  );
}
