/** Trial length for new signups (days). Default 60 during beta. */
export function getTrialDays(): number {
  const fromEnv = Number(process.env.TRIAL_DAYS);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.min(Math.floor(fromEnv), 365);
  }
  return 60;
}
