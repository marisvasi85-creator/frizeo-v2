import { getCurrentPlan } from "./getCurrentPlan";
import { planAllowsExtendedSms, planAllowsSms } from "./plans";

/** Reminder SMS (Pro / Pro+ / Custom / trial). */
export async function smsAllowedForTenant(
  tenantId: string
): Promise<boolean> {
  const plan = await getCurrentPlan(tenantId);
  return planAllowsSms(plan);
}

/** Confirmare / anulare / reprogramare SMS — doar Custom. */
export async function extendedSmsAllowedForTenant(
  tenantId: string
): Promise<boolean> {
  const plan = await getCurrentPlan(tenantId);
  return planAllowsExtendedSms(plan);
}
