import { accountingHttpResponse, accountingMaxDuration } from "@/lib/accounting/http";

export const runtime = "nodejs";
export const maxDuration = accountingMaxDuration;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return accountingHttpResponse(req, "xlsx");
}
