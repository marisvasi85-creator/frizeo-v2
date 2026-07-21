import { getAdminSession } from "@/lib/auth/getAdminSession";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { updateNotifications } from "./actions";
import FormWithSaveFeedback from "../components/FormWithSaveFeedback";
import { getCurrentPlan } from "@/lib/billing/getCurrentPlan";
import { planAllowsSms } from "@/lib/billing/plans";

export default async function NotificationsPage() {
  const session = await getAdminSession();
  if (!session?.barber) return null;

  const tenantId = session.barber.tenant_id;

  const [settingsRes, plan] = await Promise.all([
    supabaseAdmin
      .from("notification_settings")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    getCurrentPlan(tenantId),
  ]);

  const data = settingsRes.data;
  const smsAllowed = planAllowsSms(plan);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Notificări</h1>

      {!smsAllowed && (
        <p className="text-sm text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
          SMS-urile sunt disponibile pe planurile plătite (Pro, Pro+) sau în
          perioada de trial. Upgrade din Abonament pentru a activa SMS.
        </p>
      )}

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
          defaultChecked={data?.booking_sms_enabled ?? false}
          disabled={!smsAllowed}
        />

        <NotificationToggle
          name="reminder_email_enabled"
          label="Email reminder"
          defaultChecked={data?.reminder_email_enabled ?? true}
        />

        <NotificationToggle
          name="reminder_sms_enabled"
          label="SMS reminder"
          defaultChecked={data?.reminder_sms_enabled ?? false}
          disabled={!smsAllowed}
        />

        <NotificationToggle
          name="reschedule_email_enabled"
          label="Email reprogramare"
          defaultChecked={data?.reschedule_email_enabled ?? true}
        />

        <NotificationToggle
          name="reschedule_sms_enabled"
          label="SMS reprogramare"
          defaultChecked={data?.reschedule_sms_enabled ?? false}
          disabled={!smsAllowed}
        />

        <NotificationToggle
          name="cancel_email_enabled"
          label="Email anulare"
          defaultChecked={data?.cancel_email_enabled ?? true}
        />

        <NotificationToggle
          name="cancel_sms_enabled"
          label="SMS anulare"
          defaultChecked={data?.cancel_sms_enabled ?? false}
          disabled={!smsAllowed}
        />
      </FormWithSaveFeedback>
    </div>
  );
}

function NotificationToggle({
  name,
  label,
  defaultChecked,
  disabled,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center justify-between ${disabled ? "opacity-50" : ""}`}
    >
      <span>{label}</span>

      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="h-5 w-5 disabled:cursor-not-allowed"
      />
    </label>
  );
}
