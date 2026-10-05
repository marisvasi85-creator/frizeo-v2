export type UsageLedgerEntry = {
  tenantId: string;
  userId: string | null;
  feature: string;
  provider: string;
  model: string | null;
  units: number;
  inputTokens: number | null;
  outputTokens: number | null;
  creditsUsed: number;
  estimatedCostMinor: number;
  currency: string;
  createdAt: string;
};

export function usageForTenant(
  entries: readonly UsageLedgerEntry[],
  tenantId: string,
): UsageLedgerEntry[] {
  return entries.filter((entry) => entry.tenantId === tenantId);
}

export function monthlyUsageCost(input: {
  entries: readonly UsageLedgerEntry[];
  tenantId: string;
  month: string;
  currency?: string;
}): { estimatedCostMinor: number; currency: string } {
  const currency = input.currency ?? "EUR";
  const estimatedCostMinor = usageForTenant(input.entries, input.tenantId)
    .filter(
      (entry) =>
        entry.createdAt.startsWith(input.month) && entry.currency === currency,
    )
    .reduce((sum, entry) => sum + entry.estimatedCostMinor, 0);
  return { estimatedCostMinor, currency };
}
