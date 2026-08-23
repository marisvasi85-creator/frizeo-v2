import { NextResponse } from "next/server";
import { getAppUrlForRequest } from "@/lib/app/getAppUrl";
import { notifyClientAccessApprovedOnce } from "@/lib/barber-access/notifications";
import { acceptQuickApprovalToken } from "@/lib/barber-access/quickApprovalServer";
import { quickApprovalOutcomeMessage } from "@/lib/barber-access/quickApprovalToken";
import { enforceRateLimit } from "@/lib/security/rateLimit";

const PRIVATE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
};

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, {
    bucket: "barber-access-quick-accept",
    limit: 10,
    windowSeconds: 10 * 60,
  });
  if (limited) return limited;

  try {
    const body = await req.json();
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    const result = await acceptQuickApprovalToken(token);
    const content = quickApprovalOutcomeMessage(result.outcome);

    if (result.outcome === "approved" && result.requestId) {
      try {
        await notifyClientAccessApprovedOnce({
          requestId: result.requestId,
          appUrl: getAppUrlForRequest(req.url),
        });
      } catch (notificationError) {
        console.error(
          "BARBER ACCESS QUICK APPROVAL CLIENT NOTIFICATION:",
          notificationError,
        );
      }
    }

    const status =
      result.outcome === "invalid"
        ? 404
        : result.outcome === "expired"
          ? 410
          : result.outcome === "blocked" || result.outcome === "rejected"
            ? 409
            : 200;

    return NextResponse.json(
      { outcome: result.outcome, ...content },
      { status, headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    console.error("BARBER ACCESS QUICK APPROVAL:", error);
    return NextResponse.json(
      {
        outcome: "invalid",
        title: "Linkul nu mai este disponibil",
        message: "Deschide Frizeo pentru a verifica cererile în așteptare.",
      },
      { status: 500, headers: PRIVATE_HEADERS },
    );
  }
}
