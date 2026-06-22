import { getCurrentPlan } from "./getCurrentPlan";
import { planAllowsSms } from "./plans";

export async function smsAllowedForTenant(
  tenantId: string
): Promise<boolean> {
  const plan = await getCurrentPlan(tenantId);
  return planAllowsSms(plan);
}
