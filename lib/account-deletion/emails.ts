import { sendEmail } from "@/lib/email/email";
import { getAppUrl } from "@/lib/app/getAppUrl";
import { formatDeletionDateRo } from "@/lib/account-deletion/constants";
import {
  accountDeletionCancelledTemplate,
  accountDeletionCompletedTemplate,
  accountDeletionRequestedTemplate,
} from "@/lib/email/templates/account-deletion";

const CANCEL_PATH = "/admin/account";

export function accountDeletionCancelUrl(appUrl = getAppUrl()): string {
  return `${appUrl.replace(/\/$/, "")}${CANCEL_PATH}`;
}

export async function sendAccountDeletionRequestedEmail(input: {
  to: string;
  scheduledFor: string | Date;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: "Solicitarea de ștergere a contului Frizeo",
    html: accountDeletionRequestedTemplate({
      scheduledLabel: formatDeletionDateRo(input.scheduledFor),
      cancelUrl: accountDeletionCancelUrl(),
    }),
  });
}

export async function sendAccountDeletionCancelledEmail(to: string): Promise<void> {
  await sendEmail({
    to,
    subject: "Solicitarea de ștergere a fost anulată",
    html: accountDeletionCancelledTemplate(),
  });
}

export async function sendAccountDeletionCompletedEmail(to: string): Promise<void> {
  await sendEmail({
    to,
    subject: "Contul Frizeo a fost șters",
    html: accountDeletionCompletedTemplate(),
  });
}
