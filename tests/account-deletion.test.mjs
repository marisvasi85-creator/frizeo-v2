import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  ACCOUNT_DELETION_GRACE_DAYS,
  ACCOUNT_DELETION_REASONS,
  authDeletionIsLast,
  blockedOwnershipMemberships,
  buildFinalizationPlan,
  buildRequestSchedule,
  canAdminDeleteNow,
  canFinalizeAccountDeletion,
  canUserCancelRequest,
  canUserReadRequest,
  demoteOwnerRoleAfterTransfer,
  formatDeletionDateRo,
  hasActiveDeletionRequest,
  isActiveOccupancyBooking,
  isDueForWorker,
  membershipNeedsOwnershipTransfer,
  OWNERSHIP_TRANSFER_REQUIRED,
  parseOptionalReason,
  scheduledForFrom,
  shouldCancelBookingOnAccountDeletion,
  shouldCancelStripe,
  shouldNotifyAfterCancelUpdate,
  shouldSoftCloseTenant,
  simulateExpiryAllowed,
  accountDeletionWritesAllowed,
  ACCOUNT_DELETION_PRODUCTION_BLOCK_MESSAGE,
  ACCOUNT_DELETION_PRODUCTION_DB_CODE,
  isMissingAccountDeletionTableError,
  PRODUCTION_SUPABASE_PROJECT_REF,
  supabaseProjectRefFromUrl,
} from "../lib/account-deletion/decisions.ts";
import { dispositionFor } from "../lib/account-deletion/policy.ts";
import {
  canBarberGeneratePublicSlots,
  canBarberReceiveNewBookings,
  isAnonymizedBarber,
} from "../lib/barbers/schedulableBarber.ts";
import {
  accountDeletionCancelledTemplate,
  accountDeletionCompletedTemplate,
  accountDeletionRequestedTemplate,
} from "../lib/email/templates/account-deletion.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
function readRepo(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

const userA = "11111111-1111-4111-8111-111111111111";
const userB = "22222222-2222-4222-8222-222222222222";
const pendingA = {
  id: "req-a",
  user_id: userA,
  status: "pending",
  scheduled_for: "2026-09-21T12:00:00.000Z",
};

test("1 request deletion uses a 7-day grace period", () => {
  const requestedAt = new Date("2026-09-14T10:00:00.000Z");
  const schedule = buildRequestSchedule(requestedAt);
  assert.equal(ACCOUNT_DELETION_GRACE_DAYS, 7);
  assert.equal(
    schedule.scheduledFor.toISOString(),
    scheduledForFrom(requestedAt).toISOString(),
  );
  assert.equal(
    schedule.scheduledFor.getTime() - requestedAt.getTime(),
    7 * 24 * 60 * 60 * 1000,
  );
});

test("2 duplicate active request is rejected", () => {
  assert.equal(hasActiveDeletionRequest([{ status: "pending" }]), true);
  assert.equal(hasActiveDeletionRequest([{ status: "processing" }]), true);
  assert.equal(hasActiveDeletionRequest([{ status: "cancelled" }]), false);
  assert.equal(hasActiveDeletionRequest([{ status: "completed" }]), false);
  assert.equal(hasActiveDeletionRequest([]), false);
});

test("3 cancel deletion only for own pending request", () => {
  assert.equal(canUserCancelRequest(pendingA, userA), true);
  assert.equal(
    canUserCancelRequest({ ...pendingA, status: "processing" }, userA),
    false,
  );
  assert.equal(canUserCancelRequest(pendingA, userB), false);
});

test("4 user A cannot read user B request", () => {
  assert.equal(canUserReadRequest(pendingA, userA), true);
  assert.equal(canUserReadRequest(pendingA, userB), false);
  assert.equal(canUserReadRequest(null, userA), false);
});

test("5 grace period is respected by worker due check", () => {
  const now = new Date("2026-09-20T12:00:00.000Z");
  assert.equal(isDueForWorker(pendingA, now), false);
});

test("6 worker does not delete before scheduled_for", () => {
  const now = new Date("2026-09-21T11:59:59.000Z");
  assert.equal(isDueForWorker(pendingA, now), false);
  const sql = readRepo(
    "supabase/migrations/20260914180000_account_deletion_requests.sql",
  );
  assert.match(sql, /p_force_id IS NULL AND req\.scheduled_for <= now\(\)/);
  assert.match(sql, /FOR UPDATE OF req SKIP LOCKED/);
});

test("7 worker finalizes after scheduled_for", () => {
  const now = new Date("2026-09-21T12:00:00.000Z");
  assert.equal(isDueForWorker(pendingA, now), true);
  assert.equal(isDueForWorker({ ...pendingA, status: "cancelled" }, now), false);
});

test("8 idempotency: completed requests are a no-op and claim is unique", () => {
  const sql = readRepo(
    "supabase/migrations/20260914180000_account_deletion_requests.sql",
  );
  assert.match(sql, /account_deletion_requests_one_active_per_user/);
  assert.match(sql, /status IN \('pending', 'processing'\)/);
  const finalize = readRepo("lib/account-deletion/finalize.ts");
  assert.match(finalize, /status === "completed"/);
  assert.match(finalize, /skipped: true/);
});

test("9 retry after failure reclaims stale processing leases", () => {
  const sql = readRepo(
    "supabase/migrations/20260914180000_account_deletion_requests.sql",
  );
  assert.match(sql, /claim_lease_expired/);
  assert.match(sql, /req.status = 'processing'/);
  assert.match(sql, /attempt_count >= v_max THEN 'failed'/);
  assert.equal(canAdminDeleteNow({ status: "failed" }), false);
  assert.equal(canAdminDeleteNow({ status: "pending" }), true);
});

test("10 multi-tenant user is detached per membership without deleting tenants", () => {
  const plan = buildFinalizationPlan({
    memberships: [
      {
        tenantId: "t1",
        tenantName: "A",
        role: "barber",
        otherMemberCount: 2,
        otherOwnerCount: 1,
        stripeSubscriptionId: "sub_1",
      },
      {
        tenantId: "t2",
        tenantName: "B",
        role: "owner",
        otherMemberCount: 1,
        otherOwnerCount: 0,
        stripeSubscriptionId: null,
      },
    ],
    barbers: [
      {
        id: "b1",
        tenantId: "t1",
        hasGoogle: false,
        hasAvatar: false,
        bookingCount: 3,
      },
    ],
  });
  assert.deepEqual(plan.softCloseTenantIds, []);
  assert.deepEqual(plan.cancelStripeTenantIds, []);
  assert.equal(plan.never.deleteTenants, true);
  assert.equal(plan.never.deleteOtherMembers, true);
  assert.equal(plan.ownershipTransferRequired, true);
  assert.deepEqual(plan.blockedTenantIds, ["t2"]);
  assert.equal(
    canFinalizeAccountDeletion([
      {
        tenantId: "t1",
        tenantName: "A",
        role: "barber",
        otherMemberCount: 2,
        otherOwnerCount: 1,
        stripeSubscriptionId: "sub_1",
      },
      {
        tenantId: "t2",
        tenantName: "B",
        role: "owner",
        otherMemberCount: 1,
        otherOwnerCount: 0,
        stripeSubscriptionId: null,
      },
    ]),
    false,
  );
});

test("11 tenant with other members is not closed or unsubscribed from Stripe", () => {
  assert.equal(shouldSoftCloseTenant(1), false);
  assert.equal(shouldCancelStripe(3), false);
});

test("12 sole remaining user soft-closes the salon but does not delete it", () => {
  const plan = buildFinalizationPlan({
    memberships: [
      {
        tenantId: "t1",
        tenantName: "Solo",
        role: "owner",
        otherMemberCount: 0,
        otherOwnerCount: 0,
        stripeSubscriptionId: "sub_solo",
      },
    ],
    barbers: [],
  });
  assert.deepEqual(plan.softCloseTenantIds, ["t1"]);
  assert.deepEqual(plan.cancelStripeTenantIds, ["t1"]);
  assert.equal(plan.never.deleteTenants, true);
});

test("13 existing bookings are kept", () => {
  const plan = buildFinalizationPlan({
    memberships: [],
    barbers: [
      {
        id: "b1",
        tenantId: "t1",
        hasGoogle: false,
        hasAvatar: false,
        bookingCount: 12,
      },
    ],
  });
  assert.equal(plan.never.deleteBookings, true);
  assert.equal(dispositionFor("bookings"), "KEEP");
  assert.deepEqual(plan.cancelFutureBarberIds, ["b1"]);
  const finalize = readRepo("lib/account-deletion/finalize.ts");
  assert.match(finalize, /cancelFutureActiveBookingsForBarber/);
  assert.doesNotMatch(finalize, /\.from\("bookings"\)\s*\.delete\(/);
  assert.doesNotMatch(finalize, /\.from\("tenants"\)\s*\.delete\(/);
});

test("14 Google Calendar connected disconnects tokens and does not delete events", () => {
  const plan = buildFinalizationPlan({
    memberships: [],
    barbers: [
      {
        id: "b-google",
        tenantId: "t1",
        hasGoogle: true,
        hasAvatar: false,
        bookingCount: 0,
      },
    ],
  });
  assert.deepEqual(plan.disconnectBarberIds, ["b-google"]);
  assert.equal(plan.never.deleteGoogleCalendarEvents, true);
  const finalize = readRepo("lib/account-deletion/finalize.ts");
  assert.match(finalize, /disconnectGoogleForBarber/);
  assert.match(finalize, /revokeGoogleOAuthToken/);
  assert.doesNotMatch(finalize, /deleteGoogleEvent/);
  assert.doesNotMatch(finalize, /releaseGoogleCalendarEvent/);
  assert.doesNotMatch(finalize, /releaseGoogleEventForBarber/);
  const cancel = readRepo("lib/account-deletion/cancelFutureBookings.ts");
  assert.match(cancel, /notifyBookingCancelled/);
  assert.doesNotMatch(cancel, /releaseGoogleEventForBarber/);
  assert.doesNotMatch(cancel, /deleteGoogleEvent/);
  assert.doesNotMatch(cancel, /\.delete\(/);
});

test("15 storage objects: only barber avatars are removed", () => {
  const plan = buildFinalizationPlan({
    memberships: [],
    barbers: [
      {
        id: "b-av",
        tenantId: "t1",
        hasGoogle: false,
        hasAvatar: true,
        bookingCount: 0,
      },
    ],
  });
  assert.deepEqual(plan.avatarBarberIds, ["b-av"]);
  assert.equal(dispositionFor("storage:barber-avatars"), "DELETE");
  assert.equal(dispositionFor("storage:salon-logos"), "KEEP");
  assert.equal(dispositionFor("storage:salon-gallery"), "KEEP");
  const finalize = readRepo("lib/account-deletion/finalize.ts");
  assert.match(finalize, /emptyStorageFolder\("barber-avatars"/);
  assert.doesNotMatch(finalize, /salon-logos/);
  assert.doesNotMatch(finalize, /salon-gallery/);
});

test("16 Auth deletion is last mutating step", () => {
  const plan = buildFinalizationPlan({ memberships: [], barbers: [] });
  assert.equal(authDeletionIsLast(plan.steps), true);
  assert.equal(plan.steps.at(-2), "delete_auth_user");
  assert.equal(plan.steps.at(-1), "mark_completed");
  assert.equal(plan.steps.includes("cancel_future_bookings"), true);
  assert.ok(
    plan.steps.indexOf("cancel_future_bookings") <
      plan.steps.indexOf("disconnect_google"),
  );
  const finalize = readRepo("lib/account-deletion/finalize.ts");
  const authIdx = finalize.indexOf("auth.admin.deleteUser");
  const completeIdx = finalize.indexOf('status: "completed"');
  assert.ok(authIdx > 0 && completeIdx > authIdx);
});

test("17 request email copy and cancel CTA without secrets in the URL", () => {
  const html = accountDeletionRequestedTemplate({
    scheduledLabel: "21.09.2026",
    cancelUrl: "https://www.frizeo.ro/admin/account",
  });
  assert.match(html, /Am primit solicitarea de ștergere/);
  assert.match(html, /21\.09\.2026/);
  assert.match(html, /Anulează ștergerea/);
  assert.match(html, /https:\/\/www\.frizeo\.ro\/admin\/account/);
  assert.doesNotMatch(html, /token=/);
  assert.doesNotMatch(html, /secret=/);
});

test("18 cancellation email", () => {
  const html = accountDeletionCancelledTemplate();
  assert.match(html, /Solicitarea de ștergere a fost anulată/);
});

test("19 final email is sent before Auth deletion using email_snapshot", () => {
  const html = accountDeletionCompletedTemplate();
  assert.match(html, /Contul Frizeo a fost șters/);
  const finalize = readRepo("lib/account-deletion/finalize.ts");
  const emailCallIdx = finalize.indexOf(
    "await sendAccountDeletionCompletedEmail(request.email_snapshot)",
  );
  const authIdx = finalize.indexOf("auth.admin.deleteUser");
  const ownershipIdx = finalize.indexOf("plan.ownershipTransferRequired");
  assert.ok(emailCallIdx > 0 && emailCallIdx < authIdx);
  assert.ok(ownershipIdx > 0 && ownershipIdx < emailCallIdx);
  assert.match(finalize, /request.email_snapshot/);
  assert.match(finalize, /final_email_sent_at/);
});

test("20 admin Delete now uses the same finalize/claim path as the worker", () => {
  const adminRoute = readRepo("app/api/admin/account-deletion/[id]/route.ts");
  const cron = readRepo("app/api/cron/account-deletion/route.ts");
  assert.match(adminRoute, /claimAccountDeletionById/);
  assert.match(adminRoute, /finalizeAccountDeletion/);
  assert.match(cron, /runDueAccountDeletions/);
  assert.match(adminRoute, /delete_now/);
  assert.match(adminRoute, /requirePlatformCreator/);
});

test("optional feedback: other reason keeps details, known reasons drop details", () => {
  assert.deepEqual(parseOptionalReason({}), {
    ok: true,
    reason: null,
    reasonDetails: null,
  });
  assert.equal(parseOptionalReason({ reason: "nope" }).ok, false);
  const other = parseOptionalReason({
    reason: "other",
    reasonDetails: "  lipsește X  ",
  });
  assert.deepEqual(other, {
    ok: true,
    reason: "other",
    reasonDetails: "lipsește X",
  });
  const price = parseOptionalReason({
    reason: "price",
    reasonDetails: "too much",
  });
  assert.deepEqual(price, { ok: true, reason: "price", reasonDetails: null });
  assert.ok(ACCOUNT_DELETION_REASONS.includes("missing_feature"));
});

test("RLS and privileged operations stay server-side", () => {
  const sql = readRepo(
    "supabase/migrations/20260914180000_account_deletion_requests.sql",
  );
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /account_deletion_requests_select_own/);
  assert.match(sql, /user_id = auth.uid\(\)/);
  assert.match(sql, /users may only cancel a pending deletion request/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public.claim_account_deletion_batch/);
  assert.match(sql, /TO service_role/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public.claim_account_deletion_batch/);
  assert.match(sql, /ON DELETE SET NULL/);

  const requestRoute = readRepo("app/api/account-deletion/request/route.ts");
  assert.match(requestRoute, /getAuthUser/);
  assert.match(requestRoute, /confirmAccountDeletionPassword/);
  assert.doesNotMatch(requestRoute, /body\.user_id/);
  assert.doesNotMatch(requestRoute, /SUPABASE_SERVICE_ROLE_KEY/);

  const client = readRepo("app/admin/account/AccountDeletionClient.tsx");
  assert.doesNotMatch(client, /service_role/);
});

test("simulate expiry is never available in production", () => {
  assert.equal(
    simulateExpiryAllowed({
      isProduction: true,
      isStaging: false,
      isDevelopment: false,
      isPreview: false,
    }),
    false,
  );
  assert.equal(
    simulateExpiryAllowed({
      isProduction: false,
      isStaging: true,
      isDevelopment: false,
      isPreview: false,
    }),
    true,
  );
  const adminRoute = readRepo("app/api/admin/account-deletion/[id]/route.ts");
  assert.match(adminRoute, /simulateExpiryAllowed/);
  assert.match(adminRoute, /status: 404/);
});

test("barbers.user_id becomes nullable SET NULL so Auth delete cannot CASCADE bookings", () => {
  const sql = readRepo(
    "supabase/migrations/20260914180000_account_deletion_requests.sql",
  );
  assert.match(sql, /ALTER COLUMN user_id DROP NOT NULL/);
  assert.match(sql, /barbers_user_id_fkey/);
  assert.match(sql, /ON DELETE SET NULL/);
  assert.match(sql, /Do NOT restore barbers.user_id NOT NULL/);
});

test("date label is Romanian DD.MM.YYYY", () => {
  assert.match(formatDeletionDateRo("2026-09-21T10:00:00.000Z"), /\d{2}\.\d{2}\.2026/);
});

test("public booking and login routes are not rewritten by account deletion", () => {
  const untouched = [
    "app/api/bookings/create/route.ts",
    "app/api/bookings/hold/route.ts",
    "app/api/bookings/cancel/route.ts",
    "app/api/bookings/reschedule/route.ts",
    "app/api/auth/login/route.ts",
    "app/api/auth/signup/route.ts",
  ];
  for (const file of untouched) {
    const source = readRepo(file);
    assert.doesNotMatch(source, /account_deletion_requests/);
  }
});

test("anonymized barber with null user_id cannot receive new bookings or public slots", () => {
  const anonymized = { id: "b1", active: false, user_id: null };
  const inactiveAttached = { id: "b2", active: false, user_id: userA };
  const activeAttached = { id: "b3", active: true, user_id: userA };

  assert.equal(isAnonymizedBarber(anonymized), true);
  assert.equal(canBarberReceiveNewBookings(anonymized), false);
  assert.equal(canBarberGeneratePublicSlots(anonymized), false);
  assert.equal(
    canBarberGeneratePublicSlots(anonymized, {
      excludeBookingId: "bk1",
      bookingBarberId: "b1",
    }),
    false,
  );
  assert.equal(canBarberReceiveNewBookings(inactiveAttached), false);
  assert.equal(
    canBarberGeneratePublicSlots(inactiveAttached, {
      excludeBookingId: "bk1",
      bookingBarberId: "b2",
    }),
    true,
  );
  assert.equal(canBarberReceiveNewBookings(activeAttached), true);
  assert.equal(canBarberGeneratePublicSlots(activeAttached), true);
});

test("future active bookings are cancelled idempotently without duplicate notify", () => {
  const now = new Date("2026-09-21T10:00:00.000Z");
  const nowMs = now.getTime();
  assert.equal(isActiveOccupancyBooking("confirmed", null, now), true);
  assert.equal(isActiveOccupancyBooking("pending", "2026-09-21T11:00:00.000Z", now), true);
  assert.equal(isActiveOccupancyBooking("pending", "2026-09-21T09:00:00.000Z", now), false);
  assert.equal(isActiveOccupancyBooking("cancelled", null, now), false);
  assert.equal(isActiveOccupancyBooking("completed", null, now), false);
  assert.equal(isActiveOccupancyBooking("no_show", null, now), false);

  assert.equal(
    shouldCancelBookingOnAccountDeletion({
      status: "confirmed",
      expiresAt: null,
      startMs: nowMs + 60_000,
      nowMs,
    }),
    true,
  );
  assert.equal(
    shouldCancelBookingOnAccountDeletion({
      status: "confirmed",
      expiresAt: null,
      startMs: nowMs - 60_000,
      nowMs,
    }),
    false,
  );
  assert.equal(
    shouldCancelBookingOnAccountDeletion({
      status: "pending",
      expiresAt: new Date(nowMs - 1000).toISOString(),
      startMs: nowMs + 60_000,
      nowMs,
    }),
    false,
  );
  assert.equal(shouldNotifyAfterCancelUpdate({ id: "bk-1" }), true);
  assert.equal(shouldNotifyAfterCancelUpdate(null), false);

  const cancel = readRepo("lib/account-deletion/cancelFutureBookings.ts");
  assert.match(cancel, /\.in\("status", \[\.\.\.ACCOUNT_DELETION_CANCELLABLE_STATUSES\]\)/);
  assert.match(cancel, /maybeSingle/);
  assert.match(cancel, /notifyBookingCancelled/);
  assert.match(cancel, /shouldNotifyAfterCancelUpdate/);
});

test("sole owner with other members is blocked until explicit transfer", () => {
  const blocked = {
    tenantId: "t1",
    tenantName: "Salon",
    role: "owner",
    otherMemberCount: 2,
    otherOwnerCount: 0,
    stripeSubscriptionId: null,
  };
  const lastMember = {
    ...blocked,
    otherMemberCount: 0,
  };
  const alreadyHasOwner = {
    ...blocked,
    otherOwnerCount: 1,
  };
  const barberMember = {
    ...blocked,
    role: "barber",
  };

  assert.equal(membershipNeedsOwnershipTransfer(blocked), true);
  assert.equal(membershipNeedsOwnershipTransfer(lastMember), false);
  assert.equal(membershipNeedsOwnershipTransfer(alreadyHasOwner), false);
  assert.equal(membershipNeedsOwnershipTransfer(barberMember), false);
  assert.deepEqual(blockedOwnershipMemberships([blocked, barberMember]).map((m) => m.tenantId), [
    "t1",
  ]);
  assert.equal(canFinalizeAccountDeletion([lastMember]), true);
  assert.equal(demoteOwnerRoleAfterTransfer(true), "barber");
  assert.equal(demoteOwnerRoleAfterTransfer(false), "manager");
  assert.equal(OWNERSHIP_TRANSFER_REQUIRED, "ownership_transfer_required");

  const sql = readRepo(
    "supabase/migrations/20260914190000_account_deletion_ownership_and_barber_null.sql",
  );
  assert.match(sql, /transfer_tenant_ownership/);
  assert.match(sql, /v_from uuid := auth\.uid\(\)/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /RAISE EXCEPTION 'not_owner'/);
  assert.match(sql, /p_to_user_id/);
  assert.match(sql, /auth\.uid\(\)/);

  const ui = readRepo("app/admin/account/AccountDeletionClient.tsx");
  assert.match(ui, /Salonul nu poate rămâne fără owner/);
  assert.match(ui, /Transferă ownership-ul/);
  assert.match(ui, /transfer-ownership/);

  const transferApi = readRepo(
    "app/api/account-deletion/transfer-ownership/route.ts",
  );
  assert.match(transferApi, /getAuthUser/);
  assert.doesNotMatch(transferApi, /body\.fromUserId/);
  assert.doesNotMatch(transferApi, /body\.user_id/);
});

test("nullable barber.user_id guards cover public booking, RPC, RLS-equivalent helpers", () => {
  const sql = readRepo(
    "supabase/migrations/20260914190000_account_deletion_ownership_and_barber_null.sql",
  );
  assert.match(sql, /barbers_detached_must_be_inactive/);
  assert.match(sql, /user_id IS NOT NULL OR active = false/);
  assert.match(sql, /barbers_require_user_id_on_insert/);
  assert.match(sql, /barbers\.user_id is required on insert/);
  assert.match(sql, /AND b\.active = true/);
  assert.match(sql, /AND b\.user_id IS NOT NULL/);
  assert.match(sql, /Barber is not accepting bookings/);

  const scheduling = readRepo("lib/barbers/requireActiveBarberForBooking.ts");
  assert.match(scheduling, /canBarberReceiveNewBookings/);
  assert.match(scheduling, /canBarberGeneratePublicSlots/);
  assert.match(scheduling, /user_id/);

  const reschedule = readRepo("app/api/bookings/reschedule/route.ts");
  assert.match(reschedule, /allowBarberScheduling/);

  const findSlots = readRepo("lib/assistant/tools/findSlots.ts");
  assert.match(findSlots, /requireActiveBarberForNewBooking/);

  const listBarbers = readRepo("lib/assistant/tools/listBarbers.ts");
  assert.match(listBarbers, /\.eq\("active", true\)/);

  const publicPage = readRepo("app/booking/[barberId]/page.tsx");
  assert.match(publicPage, /\.eq\("active", true\)/);

  const invoices = readRepo("lib/account-deletion/policy.ts");
  assert.match(invoices, /Retained financial records/);
  assert.equal(dispositionFor("tenant_fiscal_invoices"), "KEEP");
  assert.equal(dispositionFor("subscriptions"), "KEEP");

  const worker = readRepo("lib/account-deletion/finalize.ts");
  assert.match(worker, /releaseClaimToPending/);
  assert.match(worker, /OWNERSHIP_TRANSFER_REQUIRED/);
  assert.match(worker, /skipped \+= 1/);
  assert.doesNotMatch(worker, /deleteTenant/);
});

test("account deletion reads do not crash when the table is missing", () => {
  const load = readRepo("lib/account-deletion/createRequest.ts");
  assert.match(load, /account deletion load active/);
  assert.doesNotMatch(
    load,
    /throw new Error\("Nu am putut verifica solicitarea de ștergere\."\)/,
  );

  assert.equal(
    supabaseProjectRefFromUrl(
      "https://shsompeyazrvswnjmlmw.supabase.co",
    ),
    PRODUCTION_SUPABASE_PROJECT_REF,
  );
  assert.equal(
    accountDeletionWritesAllowed({
      supabaseUrl: "https://shsompeyazrvswnjmlmw.supabase.co",
    }),
    false,
  );
  assert.equal(
    accountDeletionWritesAllowed({
      supabaseUrl: "https://fanxxytfuhnakfdzwssd.supabase.co",
    }),
    true,
  );
  assert.equal(accountDeletionWritesAllowed({ supabaseUrl: "" }), false);
  assert.equal(
    isMissingAccountDeletionTableError({
      code: "PGRST205",
      message:
        "Could not find the table 'public.account_deletion_requests' in the schema cache",
    }),
    true,
  );
  assert.equal(
    isMissingAccountDeletionTableError({
      code: "42P01",
      message: 'relation "account_deletion_requests" does not exist',
    }),
    true,
  );
  assert.equal(
    isMissingAccountDeletionTableError({
      code: "42501",
      message: "permission denied",
    }),
    false,
  );

  const page = readRepo("app/admin/account/page.tsx");
  assert.match(page, /accountDeletionWritesAreAllowed/);
  assert.match(page, /unavailableMessage/);
  const ui = readRepo("app/admin/account/AccountDeletionClient.tsx");
  assert.match(ui, /writesAllowed/);
  assert.match(ui, /unavailableMessage/);
  assert.match(ui, /Ștergerea contului nu este disponibilă pe această instanță/);

  const requestApi = readRepo("app/api/account-deletion/request/route.ts");
  const create = readRepo("lib/account-deletion/createRequest.ts");
  assert.match(create, /accountDeletionWriteBlockResponse/);
  const cancel = readRepo("lib/account-deletion/cancelRequest.ts");
  assert.match(cancel, /accountDeletionWriteBlockResponse/);
  const transfer = readRepo(
    "app/api/account-deletion/transfer-ownership/route.ts",
  );
  assert.match(transfer, /accountDeletionWriteBlockResponse/);
  const admin = readRepo("app/api/admin/account-deletion/[id]/route.ts");
  assert.match(admin, /accountDeletionWriteBlockResponse/);
  const worker = readRepo("lib/account-deletion/finalize.ts");
  assert.match(worker, /accountDeletionWritesAllowed/);
  assert.equal(ACCOUNT_DELETION_PRODUCTION_DB_CODE, "production_database");
  assert.match(ACCOUNT_DELETION_PRODUCTION_BLOCK_MESSAGE, /Supabase Staging/);
  assert.ok(requestApi.includes("createAccountDeletionRequest"));
});
