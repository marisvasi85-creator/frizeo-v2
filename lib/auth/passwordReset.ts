export const RESET_PASSWORD_GENERIC_ERROR =
  "Nu am putut trimite emailul de resetare.";

export const RESET_PASSWORD_RATE_LIMIT_ERROR =
  "Ai cerut deja un link. Așteaptă un minut înainte de o nouă încercare.";

export const RESET_PASSWORD_SENT_MESSAGE =
  "Dacă există un cont asociat acestei adrese, am trimis un link de resetare. Verifică Inbox-ul și Spam-ul.";

type ResetProviderError = {
  message?: string;
  code?: string;
  status?: number;
};

export function resetPasswordFailure(
  error: ResetProviderError | null | undefined,
): { ok: true } | { ok: false; status: 400 | 429; error: string } {
  if (!error) return { ok: true };
  const code = error.code ?? "";
  const message = error.message ?? "";
  if (
    error.status === 429 ||
    code === "over_email_send_rate_limit" ||
    /only request this after/i.test(message) ||
    /rate limit/i.test(message)
  ) {
    return { ok: false, status: 429, error: RESET_PASSWORD_RATE_LIMIT_ERROR };
  }
  return { ok: false, status: 400, error: RESET_PASSWORD_GENERIC_ERROR };
}
