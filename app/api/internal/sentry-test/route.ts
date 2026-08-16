import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Staging-only Sentry smoke test.
 * Enable with SENTRY_ENABLE_TEST_ENDPOINT=true and a secret, then:
 *   GET /api/internal/sentry-test?secret=...&mode=server
 * Disable the env var after verifying Issues in Sentry.
 */
export async function GET(request: Request) {
  if (process.env.SENTRY_ENABLE_TEST_ENDPOINT !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const configuredSecret = process.env.SENTRY_TEST_SECRET?.trim();
  if (!configuredSecret) {
    return NextResponse.json(
      { error: "SENTRY_TEST_SECRET is not configured." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const provided = url.searchParams.get("secret");
  if (!provided || provided !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mode = url.searchParams.get("mode") || "server";
  if (mode === "server") {
    throw new Error("Sentry staging test error (server)");
  }

  return NextResponse.json({
    ok: true,
    hint: "Use mode=server to throw, or open /sentry-test for a client error.",
  });
}
