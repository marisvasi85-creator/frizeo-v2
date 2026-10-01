import { NextResponse } from "next/server";
import { requirePlatformCreator } from "@/lib/auth/requirePlatformCreator";
import { handleAccountingExport } from "@/lib/accounting/handleExport";
import { loadAccountingReport } from "@/lib/accounting/loadReport";
import { stripeErrorMessage } from "@/lib/stripe";

export const accountingRuntime = "nodejs" as const;
export const accountingMaxDuration = 60;

export async function accountingHttpResponse(
  req: Request,
  format: "json" | "xlsx",
): Promise<NextResponse> {
  const auth = await requirePlatformCreator();
  if (!auth.ok) return auth.response;

  try {
    const result = await handleAccountingExport({
      user: { email: auth.email },
      searchParams: new URL(req.url).searchParams,
      format,
      loadReport: loadAccountingReport,
    });

    if (result.status !== 200) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    if (format === "xlsx" && result.xlsx && result.filename) {
      return new NextResponse(new Uint8Array(result.xlsx), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${result.filename}"`,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    return NextResponse.json(result.report, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error(
      "accounting export",
      err instanceof Error ? err.message : "error",
    );
    return NextResponse.json(
      { error: stripeErrorMessage(err) },
      { status: 500 },
    );
  }
}
