import "server-only";

import { timingSafeEqual } from "node:crypto";

export function isMarketingWorkerConfigured(): boolean {
  return Boolean(process.env.MARKETING_WORKER_SECRET?.trim());
}

function secretsMatch(provided: string | null, expected: string): boolean {
  if (!provided) return false;

  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");
  if (expectedBuffer.length !== providedBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export function isAuthorizedMarketingWorker(request: Request): boolean {
  const expected = process.env.MARKETING_WORKER_SECRET?.trim();
  if (!expected) return false;

  const { searchParams } = new URL(request.url);
  if (secretsMatch(searchParams.get("secret"), expected)) return true;

  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return false;

  return secretsMatch(authorization.slice("Bearer ".length).trim(), expected);
}
