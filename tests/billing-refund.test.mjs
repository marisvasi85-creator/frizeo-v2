import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { isPlatformCreatorEmail } from "../lib/auth/requirePlatformCreator.ts";
import {
  assessRefundability,
  classifyObservedRefund,
  FRIZEO_REFUND_FLOW_FULL_CANCEL,
  FRIZEO_REFUND_FLOW_KEY,
  planAdminRefund,
  refundIdempotencyKey,
  selectLatestPaidSubscriptionInvoice,
} from "../lib/billing/refundDecisions.ts";
import {
  applyObservedRefund,
  executeAdminRefund,
} from "../lib/billing/subscriptionRefund.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
function readRepo(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

const tenantA = "11111111-1111-4111-8111-111111111111";
const tenantB = "22222222-2222-4222-8222-222222222222";

function invoice(overrides = {}) {
  return {
    id: "in_1",
    status: "paid",
    amountPaid: 9900,
    currency: "ron",
    billingReason: "subscription_cycle",
    customerId: "cus_a",
    subscriptionId: "sub_a",
    paidAt: 1_700_000_000,
    created: 1_700_000_000,
    ...overrides,
  };
}

function payment(overrides = {}) {
  return {
    paymentIntentId: "pi_1",
    chargeId: "ch_1",
    amount: 9900,
    amountRefunded: 0,
    fullyRefunded: false,
    currency: "ron",
    ...overrides,
  };
}

function localSub(overrides = {}) {
  return {
    tenantId: tenantA,
    tenantName: "Salon A",
    tenantSlug: "salon-a",
    stripeCustomerId: "cus_a",
    stripeSubscriptionId: "sub_a",
    status: "active",
    planSlug: "pro",
    planName: "Pro",
    ...overrides,
  };
}

function createHarness(options = {}) {
  const bookings = [{ id: "b1" }, { id: "b2" }, { id: "b3" }];
  const state = {
    local: localSub(options.local),
    stripeSub: options.stripeSub ?? {
      id: "sub_a",
      customerId: "cus_a",
      status: "active",
    },
    invoices: options.invoices ?? [invoice()],
    payment: options.payment === undefined ? payment() : options.payment,
    actionRequired: options.actionRequired ?? false,
    audits: [],
    created: [],
    cancelCalls: 0,
    downgradeCalls: 0,
    syncCalls: 0,
    cancelError: options.cancelError ?? null,
    downgradeError: options.downgradeError ?? null,
    createError: options.createError ?? null,
    refundStatus: options.refundStatus ?? "succeeded",
    now: options.now ?? 10_000_000,
    bookings,
    downgraded: false,
  };

  function openFull(invoiceId) {
    return (
      state.audits.find(
        (row) =>
          row.stripeInvoiceId === invoiceId &&
          row.refundKind === "full" &&
          row.status !== "failed",
      ) ?? null
    );
  }

  function toOpen(row) {
    if (!row) return null;
    return {
      id: row.id,
      status: row.status,
      stripeRefundId: row.stripeRefundId,
      createdAtMs: row.createdAtMs,
    };
  }

  const auditApi = {
    findOpenFullByInvoice: async (invoiceId) => toOpen(openFull(invoiceId)),
    findByRefundId: async (refundId) =>
      toOpen(state.audits.find((row) => row.stripeRefundId === refundId) ?? null),
    insertAudit: async (row) => {
      const refundClash =
        row.stripeRefundId &&
        state.audits.some((existing) => existing.stripeRefundId === row.stripeRefundId);
      const invoiceClash =
        row.refundKind === "full" &&
        row.status !== "failed" &&
        openFull(row.stripeInvoiceId);
      if (refundClash || invoiceClash) return { ok: false, conflict: true };
      const stored = {
        ...row,
        id: `audit-${state.audits.length + 1}`,
        createdAtMs: state.now,
      };
      state.audits.push(stored);
      return { ok: true, id: stored.id, createdAtMs: stored.createdAtMs };
    },
    updateAudit: async (id, patch) => {
      const row = state.audits.find((item) => item.id === id);
      if (!row) throw new Error("missing audit");
      Object.assign(row, patch);
    },
  };

  const deps = {
    now: () => state.now,
    loadLocal: async (tenantId) =>
      state.local?.tenantId === tenantId ? state.local : null,
    loadStripeSubscription: async (subscriptionId) =>
      state.stripeSub?.id === subscriptionId ? state.stripeSub : null,
    listInvoices: async () => state.invoices,
    resolvePayment: async () => ({
      payment: state.payment,
      actionRequired: state.actionRequired,
    }),
    createRefund: async (input) => {
      if (state.createError) throw state.createError;
      const created = {
        id: `re_${state.created.length + 1}`,
        status: state.refundStatus,
        amount: input.amount,
        currency: input.currency,
        idempotencyKey: input.idempotencyKey,
        metadata: input.metadata,
      };
      state.created.push(created);
      if (state.refundStatus === "succeeded") {
        state.payment = {
          ...state.payment,
          amountRefunded: input.amount,
          fullyRefunded: true,
        };
      }
      return created;
    },
    listRefunds: async () =>
      state.created.map((refund) => ({
        id: refund.id,
        amount: refund.amount,
        status: refund.status,
        metadata: refund.metadata,
      })),
    cancelSubscription: async () => {
      state.cancelCalls += 1;
      if (state.cancelError) throw state.cancelError;
      if (state.stripeSub) state.stripeSub = { ...state.stripeSub, status: "canceled" };
    },
    downgradeTenant: async (tenantId) => {
      state.downgradeCalls += 1;
      if (state.downgradeError) throw state.downgradeError;
      assert.equal(tenantId, state.local.tenantId);
      state.local = {
        ...state.local,
        planSlug: "free",
        planName: "Free",
        status: "active",
        stripeSubscriptionId: null,
      };
      state.downgraded = true;
    },
    ...auditApi,
    isAlreadyRefundedError: (err) => err?.code === "charge_already_refunded",
    isInProgressError: (err) => err?.code === "idempotency_in_progress",
  };

  const observedDeps = {
    now: () => state.now,
    loadLocalBySubscription: async (subscriptionId) =>
      state.local?.stripeSubscriptionId === subscriptionId ? state.local : null,
    loadLocalByCustomer: async (customerId) =>
      state.local?.stripeCustomerId === customerId ? state.local : null,
    loadLocalByTenant: async (tenantId) =>
      state.local?.tenantId === tenantId ? state.local : null,
    findByRefundId: auditApi.findByRefundId,
    findOpenFullByInvoice: auditApi.findOpenFullByInvoice,
    insertAudit: auditApi.insertAudit,
    updateAudit: auditApi.updateAudit,
    cancelSubscription: deps.cancelSubscription,
    downgradeTenant: deps.downgradeTenant,
    syncSubscription: async () => {
      state.syncCalls += 1;
    },
  };

  return { state, deps, observedDeps, bookings };
}

function observedInput(overrides = {}) {
  return {
    refundId: "re_dash",
    refundStatus: "succeeded",
    refundAmount: 9900,
    currency: "ron",
    paymentIntentId: "pi_1",
    chargeId: "ch_1",
    metadata: null,
    invoice: invoice(),
    payment: payment(),
    stripeSubscriptionStatus: "active",
    ...overrides,
  };
}

test("non-admin cannot pass the platform creator gate", () => {
  assert.equal(isPlatformCreatorEmail("salon-owner@example.com"), false);
  assert.equal(isPlatformCreatorEmail(""), false);
  const route = readRepo("app/api/admin/billing/refund/route.ts");
  assert.match(route, /requirePlatformCreator\(/);
  assert.doesNotMatch(route, /body\.amount/);
  assert.doesNotMatch(route, /paymentIntent/);
  assert.doesNotMatch(route, /getCurrentRole\(/);
  const page = readRepo("app/admin/billing-refunds/page.tsx");
  assert.match(page, /isPlatformCreatorEmail/);
});

test("tenant without a stripe subscription is refused", async () => {
  const { deps, state } = createHarness({
    local: { stripeCustomerId: null, stripeSubscriptionId: null },
  });
  const outcome = await executeAdminRefund(deps, {
    tenantId: tenantA,
    actorUserId: "user-admin",
    actorEmail: "owner@example.com",
  });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.code, "no_subscription");
  assert.equal(state.created.length, 0);
  assert.equal(state.cancelCalls, 0);
});

test("unpaid and non-subscription invoices are not eligible", () => {
  const selected = selectLatestPaidSubscriptionInvoice(
    [
      invoice({ id: "in_open", status: "open", amountPaid: 0, paidAt: 50 }),
      invoice({ id: "in_manual", billingReason: "manual", paidAt: 80 }),
      invoice({ id: "in_old", paidAt: 10 }),
      invoice({ id: "in_new", paidAt: 90 }),
    ],
    { customerId: "cus_a", subscriptionId: "sub_a" },
  );
  assert.equal(selected?.id, "in_new");
  assert.equal(assessRefundability(0, payment()).state, "unpaid");
});

test("tenant A cannot refund a payment that belongs to tenant B", async () => {
  const { deps, state } = createHarness({
    stripeSub: { id: "sub_a", customerId: "cus_b", status: "active" },
    invoices: [invoice({ customerId: "cus_b" })],
  });
  const outcome = await executeAdminRefund(deps, {
    tenantId: tenantA,
    actorUserId: "user-admin",
    actorEmail: "owner@example.com",
  });
  assert.equal(outcome.code, "chain_mismatch");
  assert.equal(state.created.length, 0);
  assert.equal(state.downgradeCalls, 0);
  assert.notEqual(tenantA, tenantB);
});

test("partially refunded payment is refused and does not downgrade", async () => {
  const { deps, state } = createHarness({
    payment: payment({ amountRefunded: 1000, fullyRefunded: false }),
  });
  const outcome = await executeAdminRefund(deps, {
    tenantId: tenantA,
    actorUserId: "user-admin",
    actorEmail: "owner@example.com",
  });
  assert.equal(outcome.code, "partially_refunded");
  assert.equal(state.created.length, 0);
  assert.equal(state.cancelCalls, 0);
  assert.equal(state.local.planSlug, "pro");
});

test("already refunded payment does not create a second refund", async () => {
  const { deps, state } = createHarness({
    payment: payment({ amountRefunded: 9900, fullyRefunded: true }),
  });
  const outcome = await executeAdminRefund(deps, {
    tenantId: tenantA,
    actorUserId: "user-admin",
    actorEmail: "owner@example.com",
  });
  assert.equal(outcome.code, "already_refunded");
  assert.equal(state.created.length, 0);
  assert.equal(state.cancelCalls, 0);
});

test("full admin refund cancels subscription, moves tenant to Free, and keeps bookings", async () => {
  const harness = createHarness();
  const outcome = await executeAdminRefund(harness.deps, {
    tenantId: tenantA,
    actorUserId: "user-admin",
    actorEmail: "owner@example.com",
  });
  assert.equal(outcome.ok, true);
  assert.equal(outcome.code, "reconciled");
  assert.equal(harness.state.created.length, 1);
  assert.equal(harness.state.created[0].amount, 9900);
  assert.equal(
    harness.state.created[0].idempotencyKey,
    refundIdempotencyKey("in_1"),
  );
  assert.equal(
    harness.state.created[0].metadata[FRIZEO_REFUND_FLOW_KEY],
    FRIZEO_REFUND_FLOW_FULL_CANCEL,
  );
  assert.equal(harness.state.cancelCalls, 1);
  assert.equal(harness.state.downgradeCalls, 1);
  assert.equal(harness.state.local.planSlug, "free");
  assert.equal(harness.state.local.tenantName, "Salon A");
  assert.equal(harness.state.local.stripeSubscriptionId, null);
  assert.equal(harness.state.local.stripeCustomerId, "cus_a");
  assert.equal(harness.bookings.length, 3);
  assert.equal(harness.state.audits[0].status, "reconciled");
  assert.equal(harness.state.audits[0].initiatedByEmail, "owner@example.com");
});

test("API retry and a following webhook do not refund twice", async () => {
  const harness = createHarness();
  const actor = {
    tenantId: tenantA,
    actorUserId: "user-admin",
    actorEmail: "owner@example.com",
  };
  const first = await executeAdminRefund(harness.deps, actor);
  const second = await executeAdminRefund(harness.deps, actor);
  assert.equal(first.code, "reconciled");
  assert.equal(second.code, "no_subscription");
  assert.equal(harness.state.created.length, 1);

  const webhook = await applyObservedRefund(
    harness.observedDeps,
    observedInput({
      refundId: harness.state.created[0].id,
      metadata: harness.state.created[0].metadata,
      payment: payment({ amountRefunded: 9900, fullyRefunded: true }),
    }),
  );
  const duplicate = await applyObservedRefund(
    harness.observedDeps,
    observedInput({
      refundId: harness.state.created[0].id,
      metadata: harness.state.created[0].metadata,
      payment: payment({ amountRefunded: 9900, fullyRefunded: true }),
    }),
  );
  assert.equal(webhook.action, "idempotent");
  assert.equal(duplicate.action, "idempotent");
  assert.equal(harness.state.created.length, 1);
  assert.equal(harness.state.cancelCalls, 1);
});

test("in-progress refund lock blocks a second create", async () => {
  const harness = createHarness();
  harness.state.audits.push({
    id: "audit-pending",
    tenantId: tenantA,
    stripeInvoiceId: "in_1",
    stripeRefundId: null,
    refundKind: "full",
    status: "pending",
    createdAtMs: harness.state.now - 1000,
    source: "admin_api",
  });
  const outcome = await executeAdminRefund(harness.deps, {
    tenantId: tenantA,
    actorUserId: "user-admin",
    actorEmail: "owner@example.com",
  });
  assert.equal(outcome.code, "in_progress");
  assert.equal(harness.state.created.length, 0);
});

test("refund succeeds but cancel fails, then retry reconciles without a second refund", async () => {
  const harness = createHarness({ cancelError: new Error("stripe cancel down") });
  const actor = {
    tenantId: tenantA,
    actorUserId: "user-admin",
    actorEmail: "owner@example.com",
  };
  const failed = await executeAdminRefund(harness.deps, actor);
  assert.equal(failed.code, "cancel_failed");
  assert.equal(failed.retryable, true);
  assert.equal(harness.state.created.length, 1);
  assert.equal(harness.state.downgradeCalls, 0);
  assert.equal(harness.state.local.planSlug, "pro");

  harness.state.cancelError = null;
  const retried = await executeAdminRefund(harness.deps, actor);
  assert.equal(retried.code, "reconciled");
  assert.equal(harness.state.created.length, 1);
  assert.equal(harness.state.cancelCalls, 2);
  assert.equal(harness.state.local.planSlug, "free");
});

test("cancel succeeds but downgrade fails, then webhook retry reconciles", async () => {
  const harness = createHarness({ downgradeError: new Error("db down") });
  const actor = {
    tenantId: tenantA,
    actorUserId: "user-admin",
    actorEmail: "owner@example.com",
  };
  const failed = await executeAdminRefund(harness.deps, actor);
  assert.equal(failed.code, "downgrade_failed");
  assert.equal(harness.state.cancelCalls, 1);
  assert.equal(harness.state.local.planSlug, "pro");

  harness.state.downgradeError = null;
  const webhook = await applyObservedRefund(
    harness.observedDeps,
    observedInput({
      refundId: harness.state.created[0].id,
      metadata: harness.state.created[0].metadata,
      payment: payment({ amountRefunded: 9900, fullyRefunded: true }),
      stripeSubscriptionStatus: "canceled",
    }),
  );
  assert.equal(webhook.action, "reconciled");
  assert.equal(harness.state.created.length, 1);
  assert.equal(harness.state.cancelCalls, 1);
  assert.equal(harness.state.local.planSlug, "free");
  assert.equal(harness.bookings.length, 3);
});

test("partial webhook does not cancel or downgrade", async () => {
  const harness = createHarness();
  const outcome = await applyObservedRefund(
    harness.observedDeps,
    observedInput({
      refundId: "re_partial",
      refundAmount: 1500,
      payment: payment({ amount: 9900, amountRefunded: 1500 }),
    }),
  );
  const duplicate = await applyObservedRefund(
    harness.observedDeps,
    observedInput({
      refundId: "re_partial",
      refundAmount: 1500,
      payment: payment({ amount: 9900, amountRefunded: 1500 }),
    }),
  );
  assert.equal(outcome.action, "logged_partial");
  assert.equal(duplicate.action, "idempotent");
  assert.equal(harness.state.cancelCalls, 0);
  assert.equal(harness.state.downgradeCalls, 0);
  assert.equal(harness.state.syncCalls, 0);
  assert.equal(harness.state.local.planSlug, "pro");
  assert.equal(
    classifyObservedRefund({
      refundStatus: "succeeded",
      refundAmount: 1500,
      invoiceAmountPaid: 9900,
      chargeAmount: 9900,
      amountRefunded: 1500,
      fullyRefunded: false,
      metadata: { [FRIZEO_REFUND_FLOW_KEY]: FRIZEO_REFUND_FLOW_FULL_CANCEL },
    }).disposition,
    "partial",
  );
});

test("dashboard full refund syncs subscription state and does not cancel or refund again", async () => {
  const harness = createHarness();
  const first = await applyObservedRefund(
    harness.observedDeps,
    observedInput({ refundId: "re_dashboard" }),
  );
  const second = await applyObservedRefund(
    harness.observedDeps,
    observedInput({ refundId: "re_dashboard" }),
  );
  assert.equal(first.action, "synced_dashboard_refund");
  assert.equal(second.action, "synced_dashboard_refund");
  assert.equal(harness.state.cancelCalls, 0);
  assert.equal(harness.state.downgradeCalls, 0);
  assert.equal(harness.state.syncCalls, 2);
  assert.equal(harness.state.created.length, 0);
  assert.equal(harness.state.local.planSlug, "pro");
  assert.equal(harness.state.audits[0].status, "observed_full");
});

test("webhook events are observed without creating refunds, and checkout sync stays in place", () => {
  const webhook = readRepo("app/api/billing/webhook/route.ts");
  assert.match(webhook, /constructEvent/);
  assert.match(webhook, /checkout\.session\.completed/);
  assert.match(webhook, /customer\.subscription\.deleted/);
  assert.match(webhook, /invoice\.paid/);
  assert.match(webhook, /refund\.created/);
  assert.match(webhook, /refund\.updated/);
  assert.match(webhook, /refund\.failed/);
  assert.match(webhook, /charge\.refunded/);
  assert.match(readRepo("lib/billing/refundWebhook.ts"), /refund\.failed/);
  const observer = readRepo("lib/billing/refundWebhook.ts");
  assert.doesNotMatch(observer, /refunds\.create/);
  assert.doesNotMatch(observer, /createFullRefund/);
  const orchestrator = readRepo("lib/billing/subscriptionRefund.ts");
  assert.doesNotMatch(orchestrator, /from\("bookings"\)/);
  assert.doesNotMatch(orchestrator, /deleteTenant/);
  const checkout = readRepo("app/api/billing/checkout/route.ts");
  assert.match(checkout, /createSubscriptionCheckout/);
});

const actor = {
  tenantId: tenantA,
  actorUserId: "user-admin",
  actorEmail: "owner@example.com",
};

test("pending refund does not cancel or downgrade, and retry does not refund again", async () => {
  const harness = createHarness({ refundStatus: "pending" });
  const first = await executeAdminRefund(harness.deps, actor);
  const retry = await executeAdminRefund(harness.deps, actor);
  const duplicatePending = await applyObservedRefund(
    harness.observedDeps,
    observedInput({
      refundId: harness.state.created[0].id,
      refundStatus: "pending",
      metadata: harness.state.created[0].metadata,
    }),
  );
  assert.equal(first.ok, false);
  assert.equal(first.code, "refund_pending");
  assert.equal(retry.code, "refund_pending");
  assert.equal(duplicatePending.action, "refund_pending");
  assert.equal(harness.state.created.length, 1);
  assert.equal(harness.state.cancelCalls, 0);
  assert.equal(harness.state.downgradeCalls, 0);
  assert.equal(harness.state.local.planSlug, "pro");
  assert.equal(harness.state.audits[0].status, "pending");
});

test("pending refund that succeeds via webhook cancels and downgrades once", async () => {
  const harness = createHarness({ refundStatus: "pending" });
  const started = await executeAdminRefund(harness.deps, actor);
  assert.equal(started.code, "refund_pending");
  assert.equal(harness.state.cancelCalls, 0);

  const succeeded = await applyObservedRefund(
    harness.observedDeps,
    observedInput({
      refundId: harness.state.created[0].id,
      refundStatus: "succeeded",
      metadata: harness.state.created[0].metadata,
      payment: payment({ amountRefunded: 9900, fullyRefunded: true }),
    }),
  );
  const duplicate = await applyObservedRefund(
    harness.observedDeps,
    observedInput({
      refundId: harness.state.created[0].id,
      refundStatus: "succeeded",
      metadata: harness.state.created[0].metadata,
      payment: payment({ amountRefunded: 9900, fullyRefunded: true }),
    }),
  );
  assert.equal(succeeded.action, "reconciled");
  assert.equal(duplicate.action, "idempotent");
  assert.equal(harness.state.created.length, 1);
  assert.equal(harness.state.cancelCalls, 1);
  assert.equal(harness.state.downgradeCalls, 1);
  assert.equal(harness.state.local.planSlug, "free");
});

test("pending refund that fails does not cancel or downgrade", async () => {
  const harness = createHarness({ refundStatus: "pending" });
  await executeAdminRefund(harness.deps, actor);
  const failed = await applyObservedRefund(
    harness.observedDeps,
    observedInput({
      refundId: harness.state.created[0].id,
      refundStatus: "failed",
      metadata: harness.state.created[0].metadata,
    }),
  );
  const duplicate = await applyObservedRefund(
    harness.observedDeps,
    observedInput({
      refundId: harness.state.created[0].id,
      refundStatus: "failed",
      metadata: harness.state.created[0].metadata,
    }),
  );
  assert.equal(failed.action, "ignored");
  assert.equal(failed.reason, "refund_not_successful");
  assert.equal(duplicate.action, "ignored");
  assert.equal(harness.state.created.length, 1);
  assert.equal(harness.state.cancelCalls, 0);
  assert.equal(harness.state.downgradeCalls, 0);
  assert.equal(harness.state.syncCalls, 0);
  assert.equal(harness.state.local.planSlug, "pro");
  assert.equal(harness.state.audits[0].status, "failed");
});

test("planner refuses a second full refund when one is already reconciled", () => {
  const plan = planAdminRefund({
    hasLocalSubscription: true,
    stripeSubscriptionFound: true,
    linkOk: true,
    chainOk: true,
    invoice: invoice(),
    refundability: { state: "refundable", amount: 9900 },
    audit: {
      id: "audit-1",
      status: "reconciled",
      stripeRefundId: "re_1",
      createdAtMs: 1,
    },
    nowMs: 50_000,
  });
  assert.equal(plan.type, "stop");
  assert.equal(plan.code, "reconciled");
});
