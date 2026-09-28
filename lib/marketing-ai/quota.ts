export type QuotaLedger = {
  used: number;
};

/** Mirrors reserve_marketing_ai_quota: reject when used >= limit, then increment. */
export function tryReserveQuota(
  ledger: QuotaLedger,
  dailyLimit: number | null,
): boolean {
  if (dailyLimit !== null && ledger.used >= dailyLimit) return false;
  ledger.used += 1;
  return true;
}

export function releaseQuota(ledger: QuotaLedger): void {
  ledger.used = Math.max(0, ledger.used - 1);
}

export type QuotaReservation =
  | { status: "reserved"; id: string; used: number }
  | { status: "denied"; used: number }
  | { status: "unavailable" };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function interpretQuotaReservation(input: {
  data: unknown;
  errorMessage?: string | null;
}): QuotaReservation {
  if (input.errorMessage) return { status: "unavailable" };

  const row = input.data as { allowed?: unknown; used?: unknown; id?: unknown } | null;
  if (!row || typeof row !== "object") return { status: "unavailable" };

  const used = typeof row.used === "number" ? row.used : Number(row.used);
  if (!Number.isFinite(used)) return { status: "unavailable" };

  if (row.allowed !== true) {
    return { status: "denied", used };
  }

  if (typeof row.id !== "string" || !UUID_RE.test(row.id)) {
    return { status: "unavailable" };
  }

  return { status: "reserved", id: row.id, used };
}

export function shouldCountGeneration(input: {
  provider: string;
  usedTemplateFallback: boolean;
}): boolean {
  return input.provider !== "template" && !input.usedTemplateFallback;
}

/**
 * Serializes reservations the same way the SQL advisory lock does:
 * the check and the increment cannot interleave.
 */
export function createQuotaMutex() {
  let chain: Promise<void> = Promise.resolve();

  return function withQuotaLock<T>(fn: () => T): Promise<T> {
    const run = chain.then(() => fn());
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}
