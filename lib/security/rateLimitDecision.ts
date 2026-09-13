export type RateLimitRpcResult = {
  allowed: boolean | null;
  errorMessage: string | null;
};

/**
 * Auth/booking must keep working if the limiter itself is down.
 * Only a confirmed over-limit result (allowed !== true, no RPC error) blocks.
 */
export function resolveRateLimit(result: RateLimitRpcResult): "allow" | "block" {
  if (result.errorMessage) return "allow";
  return result.allowed === true ? "allow" : "block";
}
