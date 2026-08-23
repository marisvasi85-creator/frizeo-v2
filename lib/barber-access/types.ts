export const BOOKING_ACCESS_MODES = [
  "open",
  "approval_required",
  "approved_only",
] as const;

export type BookingAccessMode = (typeof BOOKING_ACCESS_MODES)[number];

export const CLIENT_ACCESS_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "blocked",
] as const;

export type ClientAccessStatus = (typeof CLIENT_ACCESS_STATUSES)[number];

export type PublicAccessStatus =
  | ClientAccessStatus
  | "not_found"
  | "invalid_phone";

export type PublicAccessResult = {
  accessMode: BookingAccessMode;
  status: PublicAccessStatus;
  canBook: boolean;
};

export function canBookForAccess(
  mode: BookingAccessMode,
  status: PublicAccessStatus,
): boolean {
  return mode === "open" || status === "approved";
}

export function publicAccessMessage(result: PublicAccessResult): string {
  if (result.canBook) return "Poți continua către programare.";
  if (result.status === "pending") return "Cerere în așteptare";
  if (result.status === "blocked") {
    return "Accesul la programări este blocat pentru acest număr.";
  }
  if (result.status === "rejected") {
    return "Solicitarea anterioară nu a fost acceptată. Pentru o nouă evaluare, contactează direct profesionistul.";
  }
  if (result.status === "invalid_phone") {
    return "Introdu un număr de telefon valid (de exemplu 07xxxxxxxx).";
  }
  if (result.accessMode === "approved_only") {
    return "Acest profesionist nu acceptă momentan clienți noi. Programările sunt disponibile doar pentru clienții deja acceptați.";
  }
  return "Acest număr nu este încă acceptat pentru programări.";
}

export function asBookingAccessMode(value: unknown): BookingAccessMode {
  return BOOKING_ACCESS_MODES.includes(value as BookingAccessMode)
    ? (value as BookingAccessMode)
    : "open";
}

export const BOOKING_ACCESS_LABELS: Record<BookingAccessMode, string> = {
  open: "Programări deschise",
  approval_required: "Clienți noi pe bază de aprobare",
  approved_only: "Doar clienți acceptați",
};
