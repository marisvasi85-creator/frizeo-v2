export const ACCOUNT_DELETION_GRACE_DAYS = 7;

export const ACCOUNT_DELETION_STATUSES = [
  "pending",
  "cancelled",
  "processing",
  "completed",
  "failed",
] as const;

export type AccountDeletionStatus =
  (typeof ACCOUNT_DELETION_STATUSES)[number];

export const ACTIVE_ACCOUNT_DELETION_STATUSES: AccountDeletionStatus[] = [
  "pending",
  "processing",
];

export const ACCOUNT_DELETION_REASONS = [
  "not_using",
  "other_app",
  "too_complicated",
  "missing_feature",
  "price",
  "technical_issues",
  "other",
] as const;

export type AccountDeletionReason =
  (typeof ACCOUNT_DELETION_REASONS)[number];

export const ACCOUNT_DELETION_REASON_LABELS: Record<
  AccountDeletionReason,
  string
> = {
  not_using: "Nu mai folosesc Frizeo",
  other_app: "Folosesc altă aplicație",
  too_complicated: "Frizeo este prea complicat",
  missing_feature: "Îmi lipsește o funcționalitate",
  price: "Prețul",
  technical_issues: "Probleme tehnice",
  other: "Alt motiv",
};

export const ANONYMIZED_BARBER_DISPLAY_NAME = "Frizer (cont șters)";

export function isAccountDeletionReason(
  value: unknown,
): value is AccountDeletionReason {
  return (
    typeof value === "string" &&
    (ACCOUNT_DELETION_REASONS as readonly string[]).includes(value)
  );
}

export function scheduledForFrom(
  requestedAt: Date,
  graceDays = ACCOUNT_DELETION_GRACE_DAYS,
): Date {
  return new Date(requestedAt.getTime() + graceDays * 24 * 60 * 60 * 1000);
}

export function formatDeletionDateRo(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("ro-RO", {
    timeZone: "Europe/Bucharest",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export type DeletionRequestLike = {
  id: string;
  user_id: string | null;
  status: AccountDeletionStatus;
  scheduled_for: string;
};

export type TenantMembershipSnapshot = {
  tenantId: string;
  tenantName: string | null;
  role: string;
  otherMemberCount: number;
  otherOwnerCount: number;
  stripeSubscriptionId: string | null;
};

export type BarberSnapshot = {
  id: string;
  tenantId: string;
  hasGoogle: boolean;
  hasAvatar: boolean;
  bookingCount: number;
};

export type FinalizationStep =
  | "send_final_email"
  | "cancel_future_bookings"
  | "disconnect_google"
  | "delete_barber_avatars"
  | "anonymize_barber"
  | "soft_close_empty_tenants"
  | "cancel_stripe_if_last_member"
  | "remove_memberships"
  | "clear_active_tenant"
  | "anonymize_marketing_contact"
  | "delete_profile"
  | "delete_auth_user"
  | "mark_completed";

export const OWNERSHIP_TRANSFER_REQUIRED = "ownership_transfer_required";

export function hasActiveDeletionRequest(
  existing: Array<{ status: string }> | null | undefined,
): boolean {
  return (existing ?? []).some((row) =>
    ACTIVE_ACCOUNT_DELETION_STATUSES.includes(
      row.status as AccountDeletionStatus,
    ),
  );
}

export function parseOptionalReason(input: {
  reason?: unknown;
  reasonDetails?: unknown;
}):
  | { ok: true; reason: AccountDeletionReason | null; reasonDetails: string | null }
  | { ok: false; error: string } {
  const rawReason = input.reason;
  if (rawReason == null || rawReason === "") {
    return { ok: true, reason: null, reasonDetails: null };
  }
  if (!isAccountDeletionReason(rawReason)) {
    return { ok: false, error: "Motiv invalid." };
  }

  let reasonDetails: string | null = null;
  if (typeof input.reasonDetails === "string") {
    const trimmed = input.reasonDetails.trim();
    if (trimmed.length > 2000) {
      return { ok: false, error: "Detaliile nu pot depăși 2000 de caractere." };
    }
    reasonDetails = trimmed.length ? trimmed : null;
  }

  if (rawReason !== "other") {
    reasonDetails = null;
  }

  return { ok: true, reason: rawReason, reasonDetails };
}

export function canUserReadRequest(
  request: DeletionRequestLike | null,
  actorUserId: string,
): boolean {
  return Boolean(request && request.user_id === actorUserId);
}

export function canUserCancelRequest(
  request: DeletionRequestLike | null,
  actorUserId: string,
): boolean {
  return Boolean(
    request &&
      request.user_id === actorUserId &&
      request.status === "pending",
  );
}

export function isDueForWorker(
  request: Pick<DeletionRequestLike, "status" | "scheduled_for">,
  now: Date,
): boolean {
  if (request.status !== "pending") return false;
  return new Date(request.scheduled_for).getTime() <= now.getTime();
}

export function canAdminDeleteNow(
  request: Pick<DeletionRequestLike, "status"> | null,
): boolean {
  return request?.status === "pending";
}

export function buildRequestSchedule(requestedAt: Date) {
  return {
    requestedAt,
    scheduledFor: scheduledForFrom(requestedAt, ACCOUNT_DELETION_GRACE_DAYS),
  };
}

export function shouldSoftCloseTenant(otherMemberCount: number): boolean {
  return otherMemberCount <= 0;
}

export function shouldCancelStripe(otherMemberCount: number): boolean {
  return otherMemberCount <= 0;
}

export function membershipNeedsOwnershipTransfer(
  membership: Pick<
    TenantMembershipSnapshot,
    "role" | "otherOwnerCount" | "otherMemberCount"
  >,
): boolean {
  return (
    membership.role === "owner" &&
    membership.otherOwnerCount === 0 &&
    membership.otherMemberCount > 0
  );
}

export function blockedOwnershipMemberships(
  memberships: TenantMembershipSnapshot[],
): TenantMembershipSnapshot[] {
  return memberships.filter(membershipNeedsOwnershipTransfer);
}

export function canFinalizeAccountDeletion(
  memberships: TenantMembershipSnapshot[],
): boolean {
  return blockedOwnershipMemberships(memberships).length === 0;
}

export function demoteOwnerRoleAfterTransfer(
  hasBarberRow: boolean,
): "barber" | "manager" {
  return hasBarberRow ? "barber" : "manager";
}

export const ACCOUNT_DELETION_CANCELLABLE_STATUSES = [
  "pending",
  "confirmed",
] as const;

export function isExpiredPendingHold(
  status: string,
  expiresAt: string | null | undefined,
  now: Date,
): boolean {
  if (status !== "pending") return false;
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= now.getTime();
}

export function isActiveOccupancyBooking(
  status: string,
  expiresAt: string | null | undefined,
  now: Date,
): boolean {
  if (status === "confirmed") return true;
  if (status === "pending") {
    return !isExpiredPendingHold(status, expiresAt, now);
  }
  return false;
}

export function shouldCancelBookingOnAccountDeletion(input: {
  status: string;
  expiresAt?: string | null;
  startMs: number;
  nowMs: number;
}): boolean {
  return (
    isActiveOccupancyBooking(input.status, input.expiresAt, new Date(input.nowMs)) &&
    input.startMs > input.nowMs
  );
}

export function shouldNotifyAfterCancelUpdate(
  updatedRow: { id: string } | null | undefined,
): boolean {
  return Boolean(updatedRow?.id);
}

export function buildFinalizationPlan(input: {
  memberships: TenantMembershipSnapshot[];
  barbers: BarberSnapshot[];
}): {
  steps: FinalizationStep[];
  softCloseTenantIds: string[];
  cancelStripeTenantIds: string[];
  disconnectBarberIds: string[];
  avatarBarberIds: string[];
  cancelFutureBarberIds: string[];
  ownershipTransferRequired: boolean;
  blockedTenantIds: string[];
  never: {
    deleteTenants: true;
    deleteBookings: true;
    deleteOtherMembers: true;
    deleteGoogleCalendarEvents: true;
    autoPromoteOwner: true;
  };
} {
  const ownershipBlocks = blockedOwnershipMemberships(input.memberships);
  const softCloseTenantIds = input.memberships
    .filter((m) => shouldSoftCloseTenant(m.otherMemberCount))
    .map((m) => m.tenantId);
  const cancelStripeTenantIds = input.memberships
    .filter(
      (m) =>
        shouldCancelStripe(m.otherMemberCount) && Boolean(m.stripeSubscriptionId),
    )
    .map((m) => m.tenantId);

  const steps: FinalizationStep[] = [
    "send_final_email",
    "cancel_future_bookings",
    "disconnect_google",
    "delete_barber_avatars",
    "anonymize_barber",
    "soft_close_empty_tenants",
    "cancel_stripe_if_last_member",
    "remove_memberships",
    "clear_active_tenant",
    "anonymize_marketing_contact",
    "delete_profile",
    "delete_auth_user",
    "mark_completed",
  ];

  return {
    steps,
    softCloseTenantIds,
    cancelStripeTenantIds,
    disconnectBarberIds: input.barbers.filter((b) => b.hasGoogle).map((b) => b.id),
    avatarBarberIds: input.barbers.filter((b) => b.hasAvatar).map((b) => b.id),
    cancelFutureBarberIds: input.barbers.map((b) => b.id),
    ownershipTransferRequired: ownershipBlocks.length > 0,
    blockedTenantIds: ownershipBlocks.map((m) => m.tenantId),
    never: {
      deleteTenants: true,
      deleteBookings: true,
      deleteOtherMembers: true,
      deleteGoogleCalendarEvents: true,
      autoPromoteOwner: true,
    },
  };
}

export function authDeletionIsLast(steps: FinalizationStep[]): boolean {
  const authIndex = steps.indexOf("delete_auth_user");
  const completedIndex = steps.indexOf("mark_completed");
  if (authIndex < 0) return false;
  const mutatingBeforeCompleted = steps.slice(0, completedIndex);
  return mutatingBeforeCompleted[mutatingBeforeCompleted.length - 1] === "delete_auth_user";
}

export function simulateExpiryAllowed(env: {
  isProduction: boolean;
  isStaging: boolean;
  isDevelopment: boolean;
  isPreview: boolean;
}): boolean {
  if (env.isProduction) return false;
  return env.isStaging || env.isDevelopment || env.isPreview;
}

/** Production Supabase project ref — never run account deletion against it. */
export const PRODUCTION_SUPABASE_PROJECT_REF = "shsompeyazrvswnjmlmw";

export const ACCOUNT_DELETION_PRODUCTION_DB_CODE = "production_database";

export const ACCOUNT_DELETION_PRODUCTION_BLOCK_MESSAGE =
  "Ștergerea contului nu rulează pe baza de producție. Conectează staging.frizeo.ro la proiectul Supabase Staging.";

export function supabaseProjectRefFromUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  try {
    return new URL(trimmed).hostname.split(".")[0]?.toLowerCase() ?? "";
  } catch {
    return "";
  }
}

export function accountDeletionWritesAllowed(input: {
  supabaseUrl: string;
}): boolean {
  const ref = supabaseProjectRefFromUrl(input.supabaseUrl);
  if (!ref) return false;
  return ref !== PRODUCTION_SUPABASE_PROJECT_REF;
}

export function isMissingAccountDeletionTableError(error: {
  code?: string | null;
  message?: string | null;
} | null | undefined): boolean {
  if (!error) return false;
  const code = (error.code ?? "").toUpperCase();
  const message = (error.message ?? "").toLowerCase();
  if (code === "42P01" || code === "PGRST205") return true;
  if (!message) return false;
  const mentionsTable = message.includes("account_deletion_requests");
  return (
    (mentionsTable &&
      (message.includes("does not exist") ||
        message.includes("could not find") ||
        message.includes("schema cache"))) ||
    message.includes("could not find the table")
  );
}
