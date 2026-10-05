export type CreditEntryType =
  | "included_grant"
  | "purchased_grant"
  | "debit"
  | "adjustment"
  | "reversal";

export type CreditLedgerEntry = {
  tenantId: string;
  entryType: CreditEntryType;
  amount: number;
  idempotencyKey: string;
  expiresAt: string | null;
};

export function creditsForTenant(
  entries: readonly CreditLedgerEntry[],
  tenantId: string,
): CreditLedgerEntry[] {
  return entries.filter((entry) => entry.tenantId === tenantId);
}

export function creditBalance(
  entries: readonly CreditLedgerEntry[],
  tenantId: string,
  now = new Date(),
): number {
  return creditsForTenant(entries, tenantId).reduce((sum, entry) => {
    if (entry.expiresAt && new Date(entry.expiresAt).getTime() <= now.getTime()) {
      return sum;
    }
    return sum + entry.amount;
  }, 0);
}

/**
 * Mirrors private.apply_credit_debit: positive amount in, negative ledger row,
 * idempotent on (tenant, key). The database function is the concurrency lock.
 */
export function planCreditDebit(input: {
  entries: readonly CreditLedgerEntry[];
  tenantId: string;
  amount: number;
  idempotencyKey: string;
  now?: Date;
}):
  | { ok: true; entry: CreditLedgerEntry; duplicate: boolean }
  | { ok: false; reason: "invalid_amount" | "insufficient_credits" } {
  if (input.amount <= 0) return { ok: false, reason: "invalid_amount" };

  const existing = creditsForTenant(input.entries, input.tenantId).find(
    (entry) => entry.idempotencyKey === input.idempotencyKey,
  );
  if (existing) return { ok: true, entry: existing, duplicate: true };

  if (creditBalance(input.entries, input.tenantId, input.now) < input.amount) {
    return { ok: false, reason: "insufficient_credits" };
  }

  return {
    ok: true,
    duplicate: false,
    entry: {
      tenantId: input.tenantId,
      entryType: "debit",
      amount: -input.amount,
      idempotencyKey: input.idempotencyKey,
      expiresAt: null,
    },
  };
}
