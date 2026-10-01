import { accountingHttpResponse } from "@/lib/accounting/http";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return accountingHttpResponse(req, "xlsx");
}
