import { NextRequest, NextResponse } from "next/server";
import { unsubscribeByToken } from "@/lib/frizeo-email/unsubscribe";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export async function POST(req: NextRequest) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalid." }, { status: 400 });
  }

  const token = String(body.token || "");
  // GDPR: only block on confirmed rate-limit (429). Infra 503 must not
  // prevent a legitimate unsubscribe.
  const limited = await enforceRateLimit(req, {
    bucket: "email-unsubscribe",
    identifier: token.slice(0, 16) || "anonymous",
    limit: 30,
    windowSeconds: 15 * 60,
  });
  if (limited?.status === 429) return limited;

  const result = await unsubscribeByToken(token, {
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: req.headers.get("user-agent"),
  });

  if (!result.ok) {
    const status = result.error === "invalid_token" ? 404 : 500;
    return NextResponse.json(
      {
        error:
          result.error === "invalid_token"
            ? "Link de dezabonare invalid sau expirat."
            : "Nu am putut procesa dezabonarea.",
      },
      { status },
    );
  }

  return NextResponse.json({
    success: true,
    alreadyUnsubscribed: result.alreadyUnsubscribed,
    emailMasked: result.emailMasked,
  });
}
