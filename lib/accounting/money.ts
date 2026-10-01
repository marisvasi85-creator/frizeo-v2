export type AccountingStatus = "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED";

const ZERO_DECIMAL = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);

const THREE_DECIMAL = new Set(["bhd", "jod", "kwd", "omr", "tnd"]);

export function currencyScale(currency: string): number {
  const code = currency.toLowerCase();
  if (ZERO_DECIMAL.has(code)) return 1;
  if (THREE_DECIMAL.has(code)) return 1000;
  return 100;
}

export function minorToMajor(amountMinor: number, currency: string): number {
  return amountMinor / currencyScale(currency);
}

export type RefundLike = {
  amount: number;
  status: string | null;
};

/**
 * Refund-urile reușite, agregate. Lista completă de refund-uri Stripe este
 * preferată. `amount_refunded` este fallback-ul când lista nu e prezentă sau
 * e trunchiată (poate include și refund-uri încă pending).
 */
export function succeededRefundMinor(charge: {
  amount_refunded?: number | null;
  refunds?: {
    data?: RefundLike[] | null;
    has_more?: boolean;
  } | null;
}): number {
  const refunds = charge.refunds;
  if (refunds && Array.isArray(refunds.data) && refunds.has_more !== true) {
    return refunds.data
      .filter((refund) => refund.status === "succeeded")
      .reduce((sum, refund) => sum + (refund.amount || 0), 0);
  }
  return Math.max(0, charge.amount_refunded ?? 0);
}

export function accountingStatus(
  paidMinor: number,
  refundedMinor: number,
): AccountingStatus {
  if (refundedMinor <= 0) return "PAID";
  if (refundedMinor >= paidMinor) return "REFUNDED";
  return "PARTIALLY_REFUNDED";
}

export function netMinor(paidMinor: number, refundedMinor: number): number {
  return Math.max(0, paidMinor - refundedMinor);
}

/**
 * TVA doar din taxele efective de pe Stripe Invoice.
 * `null` înseamnă că Stripe nu a furnizat taxă — nu se calculează din total.
 */
export function taxMinorFromTotalTaxes(
  totalTaxes: Array<{ amount: number }> | null | undefined,
): number | null {
  if (!totalTaxes || totalTaxes.length === 0) return null;
  return totalTaxes.reduce((sum, tax) => sum + tax.amount, 0);
}
