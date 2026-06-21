export function publicBookingPath(
  tenantSlug: string,
  barberSlug: string
) {
  return `/booking/salon/${tenantSlug}/${barberSlug}`;
}

export function publicSalonPath(tenantSlug: string) {
  return `/booking/salon/${tenantSlug}`;
}

export function publicBookingUrl(
  tenantSlug: string,
  barberSlug: string,
  appUrl?: string
) {
  const base =
    appUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  return `${base}${publicBookingPath(tenantSlug, barberSlug)}`;
}

export function publicSalonUrl(tenantSlug: string, appUrl?: string) {
  const base =
    appUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  return `${base}${publicSalonPath(tenantSlug)}`;
}
