import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveRateLimit } from "@/lib/security/rateLimitDecision";

type RateLimitOptions = {
  bucket: string;
  limit: number;
  windowSeconds: number;
  identifier?: string;
};

function requestIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";

  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function enforceRateLimit(
  req: Request,
  options: RateLimitOptions,
): Promise<NextResponse | null> {
  const rawIdentifier = `${requestIp(req)}:${options.identifier ?? ""}`;
  const identifierHash = createHash("sha256")
    .update(rawIdentifier)
    .digest("hex");

  const { data, error } = await supabaseAdmin.rpc("consume_api_rate_limit", {
    p_bucket: options.bucket,
    p_identifier_hash: identifierHash,
    p_limit: options.limit,
    p_window_seconds: options.windowSeconds,
  });

  if (
    resolveRateLimit({
      allowed: data === true,
      errorMessage: error?.message ?? null,
    }) === "allow"
  ) {
    if (error) {
      console.error("RATE LIMIT ERROR:", error.message);
    }
    return null;
  }

  return NextResponse.json(
    { error: "Prea multe solicitări. Încearcă din nou mai târziu." },
    {
      status: 429,
      headers: {
        "Retry-After": String(options.windowSeconds),
      },
    },
  );
}
