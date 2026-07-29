/** Invitațiile neacceptate expiră după N zile (bazat pe created_at). */
export const BARBER_INVITE_TTL_DAYS = 7;

export function barberInviteValidSinceIso(now = new Date()): string {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - BARBER_INVITE_TTL_DAYS);
  return cutoff.toISOString();
}

export function isBarberInviteExpired(
  createdAt: string | null | undefined,
  now = new Date(),
): boolean {
  if (!createdAt) return true;
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return true;
  const ageMs = now.getTime() - created;
  return ageMs > BARBER_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000;
}

export function barberInviteExpiredMessage() {
  return `Invitația a expirat (valabilă ${BARBER_INVITE_TTL_DAYS} zile). Cere owner-ului o invitație nouă.`;
}
