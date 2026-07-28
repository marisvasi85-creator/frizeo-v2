/**
 * Trial length for new signups (days).
 * Product default: 30. Env TRIAL_DAYS may shorten (1–30) for tests;
 * values above 30 (ex. beta 60 pe Vercel) are capped so new accounts get 30.
 * Existing subscriptions keep their trial_ends_at unchanged.
 */
export function getTrialDays(): number {
  const fromEnv = Number(process.env.TRIAL_DAYS);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.min(Math.floor(fromEnv), 30);
  }
  return 30;
}
