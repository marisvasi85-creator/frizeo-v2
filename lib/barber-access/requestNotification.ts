export const BARBER_ACCESS_REQUEST_SUBJECT =
  "Ai o nouă cerere de acces în Frizeo";

export type AccessRequestNotificationEvent = {
  created: boolean;
  status: string | null | undefined;
};

export type AccessRequestEmailInput = {
  barberId: string;
  appUrl: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  referral: string | null;
  message: string | null;
};

export type AccessRequestRecipient = {
  email: string;
  displayName: string | null;
};

export type AccessRequestEmailPayload = {
  to: string;
  subject: string;
  html: string;
};

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

function detailRow(label: string, value: string | null): string {
  if (!value?.trim()) return "";
  return `<p style="margin:6px 0;"><strong>${label}:</strong> ${escapeHtml(value.trim())}</p>`;
}

export function accessRequestDashboardUrl(
  barberId: string,
  appUrl: string,
): string {
  const url = new URL("/admin/client-access", appUrl);
  url.searchParams.set("barberId", barberId);
  url.searchParams.set("status", "pending");
  return url.toString();
}

export function barberAccessRequestEmailHtml(input: {
  barberName: string | null;
  dashboardUrl: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  referral: string | null;
  message: string | null;
}): string {
  const safeDashboardUrl = escapeHtml(input.dashboardUrl);
  const greeting = input.barberName?.trim()
    ? `<p>Salut, <strong>${escapeHtml(input.barberName.trim())}</strong>,</p>`
    : "";

  return `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:20px;color:#111;">
      <h2 style="margin:0 0 16px;color:#111;">Un client vrea să se programeze la tine</h2>

      ${greeting}

      <p>
        <strong>${escapeHtml(input.clientName)}</strong> a trimis o solicitare
        pentru a deveni client acceptat și pentru a se putea programa online la tine.
      </p>

      <div style="background:#f5f5f5;padding:15px;border-radius:8px;margin:20px 0;">
        ${detailRow("Nume", input.clientName)}
        ${detailRow("Telefon", input.clientPhone)}
        ${detailRow("Email", input.clientEmail)}
        ${detailRow("Recomandare", input.referral)}
        ${detailRow("Mesaj", input.message)}
      </div>

      <p style="margin:24px 0;">
        <a href="${safeDashboardUrl}" style="background:#000;color:#fff;padding:12px 20px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;">
          Vezi cererea în Frizeo
        </a>
      </p>

      <p style="font-size:13px;color:#666;">
        Dacă butonul nu funcționează, deschide acest link:<br />
        <a href="${safeDashboardUrl}" style="color:#111;word-break:break-all;">${safeDashboardUrl}</a>
      </p>

      <hr style="margin:30px 0;border:0;border-top:1px solid #e5e5e5;" />

      <p style="font-size:12px;color:#aaa;">
        Frizeo • Sistem programări
      </p>
    </div>
  `;
}

export function shouldNotifyAccessRequest(
  event: AccessRequestNotificationEvent,
): boolean {
  return event.created && event.status === "pending";
}

export async function attemptAccessRequestNotification(
  event: AccessRequestNotificationEvent,
  notify: () => Promise<void>,
  onError: (error: unknown) => void,
): Promise<boolean> {
  if (!shouldNotifyAccessRequest(event)) return false;

  try {
    await notify();
    return true;
  } catch (error) {
    onError(error);
    return false;
  }
}

export async function deliverAccessRequestEmail(
  input: AccessRequestEmailInput,
  dependencies: {
    resolveRecipient: (
      barberId: string,
    ) => Promise<AccessRequestRecipient | null>;
    send: (payload: AccessRequestEmailPayload) => Promise<void>;
  },
): Promise<boolean> {
  const recipient = await dependencies.resolveRecipient(input.barberId);
  if (!recipient?.email) return false;

  const dashboardUrl = accessRequestDashboardUrl(
    input.barberId,
    input.appUrl,
  );

  await dependencies.send({
    to: recipient.email,
    subject: BARBER_ACCESS_REQUEST_SUBJECT,
    html: barberAccessRequestEmailHtml({
      barberName: recipient.displayName,
      dashboardUrl,
      clientName: input.clientName,
      clientPhone: input.clientPhone,
      clientEmail: input.clientEmail,
      referral: input.referral,
      message: input.message,
    }),
  });

  return true;
}
