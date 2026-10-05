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
  createdAt?: string;
};

export function creditsForTenant(
  entries: readonly CreditLedgerEntry[],
  tenantId: string,
): CreditLedgerEntry[] {
  return entries.filter((entry) => entry.tenantId === tenantId);
}

type CreditLot = {
  remaining: number;
  expiresAt: number | null;
  createdAt: number;
};

function timestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isCreditLot(entry: CreditLedgerEntry): boolean {
  return (
    entry.amount > 0 &&
    (entry.entryType === "included_grant" ||
      entry.entryType === "purchased_grant" ||
      entry.entryType === "reversal" ||
      entry.entryType === "adjustment")
  );
}

function isCreditSpend(entry: CreditLedgerEntry): boolean {
  return (
    entry.amount < 0 &&
    (entry.entryType === "debit" || entry.entryType === "adjustment")
  );
}

function pickOpenLot(lots: readonly CreditLot[], at: number): number {
  let best = -1;
  for (let index = 0; index < lots.length; index += 1) {
    const lot = lots[index];
    if (lot.remaining <= 0) continue;
    if (lot.expiresAt != null && lot.expiresAt <= at) continue;
    if (best < 0) {
      best = index;
      continue;
    }
    const current = lots[best];
    const expiresSooner =
      lot.expiresAt != null &&
      (current.expiresAt == null ||
        lot.expiresAt < current.expiresAt ||
        (lot.expiresAt === current.expiresAt && lot.createdAt < current.createdAt));
    const bothPermanent =
      lot.expiresAt == null &&
      current.expiresAt == null &&
      lot.createdAt < current.createdAt;
    if (expiresSooner || bothPermanent) best = index;
  }
  return best;
}

/**
 * A debit consumes the soonest-expiring grant that was still valid when the
 * debit was written. When that grant expires, its remainder and the debit
 * both leave the balance, so a later grant is not reduced.
 */
export function creditBalance(
  entries: readonly CreditLedgerEntry[],
  tenantId: string,
  now = new Date(),
): number {
  const rows = creditsForTenant(entries, tenantId).slice().sort((left, right) => {
    const created = (timestamp(left.createdAt) ?? 0) - (timestamp(right.createdAt) ?? 0);
    if (created !== 0) return created;
    return left.idempotencyKey.localeCompare(right.idempotencyKey);
  });
  const lots: CreditLot[] = [];

  for (const entry of rows) {
    const createdAt = timestamp(entry.createdAt) ?? 0;
    if (isCreditLot(entry)) {
      lots.push({
        remaining: entry.amount,
        expiresAt: timestamp(entry.expiresAt),
        createdAt,
      });
      continue;
    }
    if (!isCreditSpend(entry)) continue;

    let need = -entry.amount;
    while (need > 0) {
      const index = pickOpenLot(lots, createdAt);
      if (index < 0) break;
      const take = Math.min(need, lots[index].remaining);
      lots[index].remaining -= take;
      need -= take;
    }
  }

  const at = now.getTime();
  return lots.reduce((sum, lot) => {
    if (lot.expiresAt != null && lot.expiresAt <= at) return sum;
    return sum + lot.remaining;
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
      createdAt: (input.now ?? new Date()).toISOString(),
    },
  };
}
