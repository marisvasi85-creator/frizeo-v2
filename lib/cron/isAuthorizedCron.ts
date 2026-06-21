export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") === secret) return true;

  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}
