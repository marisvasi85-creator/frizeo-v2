import { getAppUrl } from "@/lib/app/getAppUrl";
import { publicBookingUrl } from "@/lib/booking/publicBookingPath";
import { sendEmail } from "@/lib/email/email";
import { supabaseAdmin } from "@/lib/supabase/admin";

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[char] ?? char;
  });
}

export async function notifyBarberAboutAccessRequest(input: {
  barberId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  referral: string | null;
  message: string | null;
}) {
  const { data: barber } = await supabaseAdmin
    .from("barbers")
    .select("user_id, display_name")
    .eq("id", input.barberId)
    .maybeSingle();

  if (!barber?.user_id) return;

  const { data } = await supabaseAdmin.auth.admin.getUserById(barber.user_id);
  const barberEmail = data.user?.email;
  if (!barberEmail) return;

  const dashboardUrl = `${getAppUrl()}/admin/client-access`;
  const optionalRows = [
    input.clientEmail
      ? `<p><strong>Email:</strong> ${escapeHtml(input.clientEmail)}</p>`
      : "",
    input.referral
      ? `<p><strong>Recomandare:</strong> ${escapeHtml(input.referral)}</p>`
      : "",
    input.message
      ? `<p><strong>Mesaj:</strong> ${escapeHtml(input.message)}</p>`
      : "",
  ].join("");

  await sendEmail({
    to: barberEmail,
    subject: "Solicitare nouă de acces la programări",
    html: `
      <h2>Solicitare nouă pentru ${escapeHtml(barber.display_name || "programări")}</h2>
      <p><strong>Client:</strong> ${escapeHtml(input.clientName)}</p>
      <p><strong>Telefon:</strong> ${escapeHtml(input.clientPhone)}</p>
      ${optionalRows}
      <p><a href="${escapeHtml(dashboardUrl)}">Gestionează solicitarea în Frizeo</a></p>
    `,
  });
}

export async function notifyClientAccessApproved(input: {
  barberId: string;
  clientEmail: string | null;
  clientName: string;
}) {
  if (!input.clientEmail) return;

  const { data: barber } = await supabaseAdmin
    .from("barbers")
    .select("display_name, slug, tenant:tenants(slug, name)")
    .eq("id", input.barberId)
    .maybeSingle();

  const tenant = Array.isArray(barber?.tenant)
    ? barber?.tenant[0]
    : barber?.tenant;
  if (!barber?.slug || !tenant?.slug) return;

  const bookingUrl = publicBookingUrl(
    tenant.slug,
    barber.slug,
    getAppUrl(),
  );

  await sendEmail({
    to: input.clientEmail,
    subject: "Acces aprobat pentru programări",
    html: `
      <h2>Solicitarea ta a fost aprobată</h2>
      <p>Bună, ${escapeHtml(input.clientName)}.</p>
      <p>Te poți programa acum la ${escapeHtml(barber.display_name || "profesionistul ales")} folosind numărul de telefon din solicitare.</p>
      <p><a href="${escapeHtml(bookingUrl)}">Alege data și ora</a></p>
    `,
  });
}
