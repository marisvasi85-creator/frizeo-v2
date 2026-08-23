import { getAppUrl } from "@/lib/app/getAppUrl";
import { publicBookingUrl } from "@/lib/booking/publicBookingPath";
import { sendEmail } from "@/lib/email/email";
import { normalizeRomanianPhone } from "@/lib/phone/normalizeRomanianPhone";
import { sendSms } from "@/lib/sms/sendSms";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  CLIENT_ACCESS_APPROVED_SUBJECT,
  clientAccessApprovedEmailHtml,
} from "./clientApprovalNotification";
import { claimApprovalNotification } from "./quickApprovalServer";
import { deliverAccessRequestChannels } from "./requestNotification";

export async function notifyBarberAboutAccessRequest(input: {
  barberId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  referral: string | null;
  message: string | null;
  appUrl: string;
  quickActionUrl: string | null;
}) {
  const barberQuery = input.quickActionUrl
    ? await supabaseAdmin
        .from("barbers")
        .select(
          "user_id, display_name, phone, tenant_id, access_request_sms_enabled",
        )
        .eq("id", input.barberId)
        .maybeSingle()
    : await supabaseAdmin
        .from("barbers")
        .select("user_id, display_name, phone, tenant_id")
        .eq("id", input.barberId)
        .maybeSingle();
  const { data: barber, error: barberError } = barberQuery;

  if (barberError) throw barberError;
  if (!barber) return null;

  const { data: authData, error: authError } = barber.user_id
    ? await supabaseAdmin.auth.admin.getUserById(barber.user_id)
    : { data: { user: null }, error: null };
  if (authError) {
    // Resolving the email address and delivering the SMS are independent.
    // A temporary Auth Admin failure must not suppress the SMS channel.
    console.error("BARBER ACCESS REQUEST EMAIL RECIPIENT:", authError);
  }

  const smsPhone = normalizeRomanianPhone(barber.phone ?? "");
  return deliverAccessRequestChannels(
    input,
    {
      email: authError ? null : (authData.user?.email ?? null),
      phone: smsPhone,
      displayName: barber.display_name,
      smsEnabled:
        Boolean(input.quickActionUrl) &&
        Boolean(
          "access_request_sms_enabled" in barber
            ? (barber.access_request_sms_enabled ?? true)
            : true,
        ),
    },
    {
      sendEmail,
      sendSms: async (phone, message) => {
        const result = await sendSms({
          phone,
          message,
          meta: {
            tenantId: barber.tenant_id,
            barberId: input.barberId,
            smsType: "access_request",
          },
        });
        return result.ok;
      },
      onError: (channel, error) => {
        console.error(`BARBER ACCESS REQUEST ${channel.toUpperCase()}:`, error);
      },
    },
  );
}

export async function notifyClientAccessApproved(input: {
  barberId: string;
  clientEmail: string | null;
  clientName: string;
  appUrl?: string;
}) {
  if (!input.clientEmail) return false;

  const { data: barber, error } = await supabaseAdmin
    .from("barbers")
    .select("display_name, slug, tenant:tenants(slug, name)")
    .eq("id", input.barberId)
    .maybeSingle();
  if (error) throw error;

  const tenant = Array.isArray(barber?.tenant)
    ? barber.tenant[0]
    : barber?.tenant;
  if (!barber?.slug || !tenant?.slug) return false;

  const barberName = barber.display_name || "profesionistul ales";
  const bookingUrl = publicBookingUrl(
    tenant.slug,
    barber.slug,
    input.appUrl ?? getAppUrl(),
  );

  await sendEmail({
    to: input.clientEmail,
    subject: CLIENT_ACCESS_APPROVED_SUBJECT,
    html: clientAccessApprovedEmailHtml({
      clientName: input.clientName,
      barberName,
      bookingUrl,
    }),
  });

  return true;
}

export async function notifyClientAccessApprovedOnce(input: {
  requestId: string;
  appUrl?: string;
}): Promise<boolean> {
  try {
    const claimed = await claimApprovalNotification(input.requestId);
    if (!claimed) return false;

    return await notifyClientAccessApproved({
      barberId: claimed.barberId,
      clientEmail: claimed.clientEmail,
      clientName: claimed.clientName,
      appUrl: input.appUrl,
    });
  } catch (error) {
    console.error("BARBER ACCESS CLIENT APPROVAL EMAIL:", error);
    return false;
  }
}
