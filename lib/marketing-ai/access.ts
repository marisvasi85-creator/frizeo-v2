export type MarketingActorRole = "owner" | "manager" | "barber";

export function resolveMarketingBarberId(input: {
  role: MarketingActorRole;
  requestedBarberId?: string | null;
  currentBarberId?: string | null;
}): { ok: true; barberId: string } | { ok: false; error: string; status: number } {
  if (input.role === "barber") {
    if (!input.currentBarberId) {
      return { ok: false, error: "Frizer negăsit", status: 403 };
    }
    return { ok: true, barberId: input.currentBarberId };
  }

  if (input.role === "owner" || input.role === "manager") {
    if (!input.requestedBarberId) {
      return { ok: false, error: "Alege frizerul", status: 400 };
    }
    return { ok: true, barberId: input.requestedBarberId };
  }

  return { ok: false, error: "Forbidden", status: 403 };
}

export function serviceBelongsToBarber(
  serviceIds: readonly string[],
  serviceId: string | null | undefined,
): boolean {
  if (!serviceId) return false;
  return serviceIds.includes(serviceId);
}
