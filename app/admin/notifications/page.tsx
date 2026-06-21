import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { updateNotifications } from "./actions";
import FormWithSaveFeedback from "../components/FormWithSaveFeedback";

export default async function NotificationsPage() {
  const barber = await getCurrentBarberInTenant();

  if (!barber) return null;

  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("notification_settings")
    .select("*")
    .eq("tenant_id", barber.tenant_id)
    .single();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Notificări</h1>

      <FormWithSaveFeedback
        action={updateNotifications}
        className="bg-[#161618] border border-white/10 rounded-xl p-6 space-y-6"
      >
        <NotificationToggle
          name="booking_email_enabled"
          label="Email confirmare"
          defaultChecked={data?.booking_email_enabled ?? true}
        />

        <NotificationToggle
          name="booking_sms_enabled"
          label="SMS confirmare"
          defaultChecked={data?.booking_sms_enabled ?? true}
        />

        <NotificationToggle
          name="reminder_email_enabled"
          label="Email reminder"
          defaultChecked={data?.reminder_email_enabled ?? true}
        />

        <NotificationToggle
          name="reminder_sms_enabled"
          label="SMS reminder"
          defaultChecked={data?.reminder_sms_enabled ?? true}
        />

        <NotificationToggle
          name="reschedule_email_enabled"
          label="Email reprogramare"
          defaultChecked={data?.reschedule_email_enabled ?? true}
        />

        <NotificationToggle
          name="reschedule_sms_enabled"
          label="SMS reprogramare"
          defaultChecked={data?.reschedule_sms_enabled ?? true}
        />

        <NotificationToggle
          name="cancel_email_enabled"
          label="Email anulare"
          defaultChecked={data?.cancel_email_enabled ?? true}
        />

        <NotificationToggle
          name="cancel_sms_enabled"
          label="SMS anulare"
          defaultChecked={data?.cancel_sms_enabled ?? true}
        />
      </FormWithSaveFeedback>
    </div>
  );
}

function NotificationToggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center justify-between">
      <span>{label}</span>

      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-5 w-5"
      />
    </label>
  );
}
