import { accountingAccessForUser } from "@/lib/accounting/access";
import {
  parseAccountingQuery,
  type AccountingPeriod,
} from "@/lib/accounting/period";
import type { AccountingReport } from "@/lib/accounting/types";
import {
  accountingWorkbookFilename,
  buildAccountingWorkbook,
} from "@/lib/accounting/xlsx";

export type AccountingExportResult =
  | { status: 401 | 403 | 400; error: string }
  | { status: 200; report: AccountingReport; xlsx?: undefined; filename?: undefined }
  | { status: 200; report: AccountingReport; xlsx: Buffer; filename: string };

export async function handleAccountingExport(input: {
  user: { email?: string | null } | null;
  searchParams: URLSearchParams;
  format: "json" | "xlsx";
  now?: Date;
  loadReport: (period: AccountingPeriod) => Promise<AccountingReport>;
}): Promise<AccountingExportResult> {
  const access = accountingAccessForUser(input.user);
  if (!access.ok) return { status: access.status, error: access.error };

  const parsed = parseAccountingQuery(input.searchParams, input.now);
  if (!parsed.ok) return { status: 400, error: parsed.error };

  const report = await input.loadReport(parsed.period);
  if (input.format === "xlsx") {
    return {
      status: 200,
      report,
      xlsx: buildAccountingWorkbook(report),
      filename: accountingWorkbookFilename(report),
    };
  }
  return { status: 200, report };
}
