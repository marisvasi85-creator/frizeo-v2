import "server-only";

import { timingSafeEqual } from "node:crypto";

export function isMarketingWorkerConfigured(): boolean {
  return Boolean(process.env.MARKETING_WORKER_SECRET?.trim());
}

export function isAuthorizedMarketingWorker(request: Request): boolean {
  const expected = process.env.MARKETING_WORKER_SECRET?.trim();
  if (!expected) return false;

  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return false;

  const provided = authorization.slice("Bearer ".length).trim();
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");
  if (expectedBuffer.length !== providedBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, providedBuffer);
}
