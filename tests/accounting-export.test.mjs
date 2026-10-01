import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { accountingAccessForUser } from "../lib/accounting/access.ts";
import { handleAccountingExport } from "../lib/accounting/handleExport.ts";
import {
  accountingStatus,
  netMinor,
  succeededRefundMinor,
  taxMinorFromTotalTaxes,
} from "../lib/accounting/money.ts";
import {
  currentMonthInBucharest,
  parseAccountingQuery,
  periodFromCivilDates,
  periodFromMonth,
} from "../lib/accounting/period.ts";
import { buildAccountingReport } from "../lib/accounting/report.ts";
import {
  normalizeStripeInvoice,
  readStripePayments,
  stripeAccountingClient,
} from "../lib/accounting/stripeRead.ts";
import { buildAdminNavItems } from "../app/admin/components/adminNav.ts";
import { buildAccountingWorkbook } from "../lib/accounting/xlsx.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
function readRepo(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

const CREATOR = "creator@frizeo.test";

function withCreatorEnv(fn) {
  const previous = process.env.PLATFORM_CREATOR_EMAILS;
  process.env.PLATFORM_CREATOR_EMAILS = CREATOR;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (previous == null) delete process.env.PLATFORM_CREATOR_EMAILS;
      else process.env.PLATFORM_CREATOR_EMAILS = previous;
    });
}

function october() {
  const parsed = periodFromMonth("2026-10");
  assert.equal(parsed.ok, true);
  return parsed.period;
}

function charge(overrides = {}) {
  return {
    id: "ch_paid",
    amount: 7900,
    amount_refunded: 0,
    currency: "ron",
    created: Date.parse("2026-10-15T09:00:00Z") / 1000,
    paid: true,
    status: "succeeded",
    customer: "cus_salon",
    payment_intent: "pi_paid",
    refunds: { data: [], has_more: false },
    ...overrides,
  };
}

function paidInvoice(overrides = {}) {
  return {
    id: "in_paid",
    number: "F-100",
    status: "paid",
    currency: "ron",
    subtotal: 7900,
    total: 7900,
    amount_paid: 7900,
    customer_name: "Frizeria Nord",
    customer_email: "nord@example.com",
    customer_address: {
      line1: "Str. Lalelelor 1",
      city: "Cluj-Napoca",
      postal_code: "400000",
      country: "RO",
    },
    customer_tax_ids: [{ type: "ro_tin", value: "RO12345678" }],
    total_taxes: null,
    subscriptionId: "sub_nord",
    lines: [
      {
        description: "Abonament Pro",
        amount: 7900,
        priceId: null,
        period: {
          start: Date.parse("2026-10-01T00:00:00Z") / 1000,
          end: Date.parse("2026-11-01T00:00:00Z") / 1000,
        },
      },
    ],
    ...overrides,
  };
}

function paymentLink(overrides = {}) {
  return {
    id: "inpay_paid",
    status: "paid",
    amount_paid: 7900,
    currency: "ron",
    created: Date.parse("2026-10-15T09:00:00Z") / 1000,
    invoice: "in_paid",
    payment: { type: "payment_intent", payment_intent: "pi_paid" },
    status_transitions: { paid_at: Date.parse("2026-10-15T09:00:00Z") / 1000 },
    ...overrides,
  };
}

const tenant = {
  tenantId: "ten_1",
  tenantName: "Salon Nord",
  stripeCustomerId: "cus_salon",
  stripeSubscriptionId: "sub_nord",
  billingType: "company",
  billingName: "Nord SRL",
  billingCui: "12345678",
  addressLine1: "Str. Lalelelor 1",
  city: "Cluj-Napoca",
  county: "Cluj",
  postalCode: "400000",
  country: "RO",
};

function monthPeriod(month) {
  const parsed = periodFromMonth(month);
  assert.equal(parsed.ok, true);
  return parsed.period;
}

function refund(overrides = {}) {
  return {
    id: "re_ok",
    amount: 2000,
    status: "succeeded",
    created: Date.parse("2026-10-15T12:00:00Z") / 1000,
    currency: "ron",
    chargeId: "ch_paid",
    paymentIntentId: "pi_paid",
    ...overrides,
  };
}

function reportFor(overrides) {
  return buildAccountingReport({
    charges: [charge()],
    invoicePayments: [paymentLink()],
    invoices: [paidInvoice()],
    tenants: [tenant],
    period: october(),
    ...overrides,
  });
}

test("1 și 16: user normal sau anonim este refuzat, fără încărcarea raportului", async () => {
  await withCreatorEnv(async () => {
    assert.equal(accountingAccessForUser(null).status, 401);
    assert.equal(
      accountingAccessForUser({ email: "owner@salon.test" }).status,
      403,
    );

    let loaded = false;
    const denied = await handleAccountingExport({
      user: { email: "owner@salon.test" },
      searchParams: new URLSearchParams({ month: "2026-10" }),
      format: "json",
      loadReport: async () => {
        loaded = true;
        throw new Error("nu trebuie să încarce Stripe");
      },
    });
    assert.equal(denied.status, 403);
    assert.equal(denied.error, "Forbidden");
    assert.equal(loaded, false);

    const anonymous = await handleAccountingExport({
      user: null,
      searchParams: new URLSearchParams(),
      format: "xlsx",
      loadReport: async () => {
        loaded = true;
        throw new Error("nu trebuie să încarce Stripe");
      },
    });
    assert.equal(anonymous.status, 401);
    assert.equal(loaded, false);
  });
});

test("2: Platform Creator are acces", async () => {
  await withCreatorEnv(async () => {
    assert.equal(accountingAccessForUser({ email: "Creator@Frizeo.test" }).ok, true);
    const result = await handleAccountingExport({
      user: { email: CREATOR },
      searchParams: new URLSearchParams({ month: "2026-10" }),
      format: "json",
      now: new Date("2026-10-15T12:00:00Z"),
      loadReport: async (period) =>
        buildAccountingReport({
          charges: [],
          invoicePayments: [],
          invoices: [],
          tenants: [],
          period,
          generatedAt: new Date("2026-10-15T12:00:00Z"),
        }),
    });
    assert.equal(result.status, 200);
    assert.equal(result.report.period.from, "2026-10-01");
    assert.equal(result.report.period.to, "2026-10-31");
  });
});

test("3: interval invalid întoarce eroare controlată și nu încarcă Stripe", async () => {
  await withCreatorEnv(async () => {
    let loaded = false;
    const reversed = await handleAccountingExport({
      user: { email: CREATOR },
      searchParams: new URLSearchParams({ from: "2026-10-20", to: "2026-10-01" }),
      format: "json",
      loadReport: async () => {
        loaded = true;
        throw new Error("no");
      },
    });
    assert.equal(reversed.status, 400);
    assert.match(reversed.error, /început/);
    assert.equal(loaded, false);

    const partial = parseAccountingQuery(new URLSearchParams({ from: "2026-10-01" }));
    assert.equal(partial.ok, false);

    const tooLong = periodFromCivilDates("2024-01-01", "2026-01-01");
    assert.equal(tooLong.ok, false);
    assert.match(tooLong.error, /366/);

    const badMonth = periodFromMonth("2026-13");
    assert.equal(badMonth.ok, false);
  });
});

test("4 și 5: invoice plătită intră în raport, invoice neplătită nu este încasare", () => {
  const paid = reportFor();
  assert.equal(paid.paymentCount, 1);
  assert.equal(paid.rows[0].stripeInvoiceId, "in_paid");
  assert.equal(paid.rows[0].stripeInvoiceNumber, "F-100");
  assert.equal(paid.rows[0].salon, "Salon Nord");
  assert.equal(paid.rows[0].company, "Frizeria Nord");
  assert.equal(paid.rows[0].taxId, "RO12345678");
  const companyFromTenant = reportFor({
    invoices: [paidInvoice({ customer_name: null, customer_tax_ids: null })],
  });
  assert.equal(companyFromTenant.rows[0].company, "Nord SRL");
  assert.equal(companyFromTenant.rows[0].taxId, "12345678");

  const unpaid = buildAccountingReport({
    charges: [
      charge({
        id: "ch_failed",
        status: "failed",
        paid: false,
        payment_intent: "pi_open",
      }),
    ],
    invoicePayments: [
      paymentLink({
        id: "inpay_open",
        status: "open",
        invoice: "in_open",
        payment: { type: "payment_intent", payment_intent: "pi_open" },
        amount_paid: 0,
      }),
    ],
    invoices: [
      paidInvoice({
        id: "in_open",
        status: "open",
        amount_paid: 0,
        number: "DRAFT",
      }),
    ],
    tenants: [tenant],
    period: october(),
  });
  assert.equal(unpaid.paymentCount, 0);
  assert.equal(unpaid.totalsByCurrency.length, 0);
});

test("6–10: fără refund, parțial, integral, mai multe refund-uri și net", () => {
  const paid = reportFor();
  assert.equal(paid.rows[0].paid, 79);
  assert.equal(paid.rows[0].refunded, 0);
  assert.equal(paid.rows[0].net, 79);
  assert.equal(paid.rows[0].net, paid.rows[0].paid - paid.rows[0].refunded);
  assert.equal(paid.rows[0].status, "PAID");
  assert.equal(accountingStatus(7900, 0), "PAID");

  const partial = reportFor({
    charges: [
      charge({
        amount_refunded: 7900,
        refunds: {
          has_more: false,
          data: [
            { id: "re_embedded", amount: 7900, status: "succeeded" },
          ],
        },
      }),
    ],
    refunds: [
      refund({ id: "re_ok", amount: 2000, status: "succeeded" }),
      refund({ id: "re_pending", amount: 5900, status: "pending" }),
      refund({ id: "re_failed", amount: 1000, status: "failed" }),
      refund({ id: "re_canceled", amount: 1000, status: "canceled" }),
    ],
  });
  assert.equal(partial.rows.length, 1);
  assert.equal(partial.rows[0].paid, 79);
  assert.equal(partial.rows[0].refunded, 20);
  assert.equal(partial.rows[0].net, 59);
  assert.equal(partial.rows[0].status, "PARTIALLY_REFUNDED");
  assert.equal(partial.rows[0].total, 79);

  const full = reportFor({
    charges: [charge({ amount_refunded: 7900 })],
    refunds: [refund({ id: "re_full", amount: 7900, status: "succeeded" })],
  });
  assert.equal(full.rows.length, 1);
  assert.equal(full.rows[0].refunded, 79);
  assert.equal(full.rows[0].net, 0);
  assert.equal(full.rows[0].status, "REFUNDED");

  const multiple = succeededRefundMinor({
    amount_refunded: 0,
    refunds: {
      has_more: false,
      data: [
        { amount: 3000, status: "succeeded" },
        { amount: 1500, status: "succeeded" },
        { amount: 400, status: "failed" },
      ],
    },
  });
  assert.equal(multiple, 4500);
  assert.equal(netMinor(7900, multiple), 3400);
  const aggregated = reportFor({
    charges: [charge({ amount_refunded: 7900 })],
    refunds: [
      refund({ id: "re_a", amount: 3000, status: "succeeded" }),
      refund({ id: "re_b", amount: 1500, status: "succeeded" }),
      refund({ id: "re_c", amount: 400, status: "failed" }),
      refund({
        id: "re_next_month",
        amount: 3400,
        status: "succeeded",
        created: Date.parse("2026-11-03T08:00:00Z") / 1000,
      }),
    ],
  });
  assert.equal(aggregated.rows[0].refunded, 45);
  assert.equal(aggregated.rows[0].net, 34);
  assert.equal(
    aggregated.rows[0].net,
    aggregated.rows[0].paid - aggregated.rows[0].refunded,
  );
  assert.equal(aggregated.rows[0].status, "PARTIALLY_REFUNDED");
});

test("11: peste 100 de tranzacții paginarea Stripe adună toate charge-urile", async () => {
  const period = october();
  const charges = Array.from({ length: 150 }, (_, index) =>
    charge({
      id: `ch_${String(index).padStart(3, "0")}`,
      payment_intent: null,
      amount: 1000,
      currency: index % 2 === 0 ? "ron" : "eur",
      created: period.startUnix + 3600,
      refunds: { data: [], has_more: false },
    }),
  );
  const calls = [];
  const client = {
    charges: {
      list: async (params) => {
        calls.push(["charges.list", params.starting_after ?? null, params.limit]);
        const start = params.starting_after
          ? charges.findIndex((item) => item.id === params.starting_after) + 1
          : 0;
        const data = charges.slice(start, start + params.limit);
        return { data, has_more: start + data.length < charges.length };
      },
    },
    invoicePayments: {
      list: async () => {
        calls.push(["invoicePayments.list"]);
        return { data: [], has_more: false };
      },
    },
    invoices: {
      list: async () => {
        calls.push(["invoices.list"]);
        return { data: [], has_more: false };
      },
      retrieve: async () => {
        throw new Error("retrieve nu e necesar");
      },
      listLineItems: async () => ({ data: [], has_more: false }),
    },
    refunds: {
      list: async () => {
        calls.push(["refunds.list"]);
        return { data: [], has_more: false };
      },
    },
  };

  const collected = await readStripePayments(client, period);
  assert.equal(collected.charges.length, 150);
  assert.deepEqual(
    calls.filter((call) => call[0] === "charges.list"),
    [
      ["charges.list", null, 100],
      ["charges.list", "ch_099", 100],
    ],
  );
  const report = buildAccountingReport({
    ...collected,
    tenants: [],
    period,
  });
  assert.equal(report.paymentCount, 150);
});

test("12: RON și EUR rămân totaluri separate", () => {
  const report = buildAccountingReport({
    charges: [
      charge({ id: "ch_ron", amount: 7900, currency: "ron" }),
      charge({
        id: "ch_eur",
        amount: 1000,
        currency: "eur",
        payment_intent: "pi_eur",
      }),
    ],
    invoicePayments: [
      paymentLink(),
      paymentLink({
        id: "inpay_eur",
        invoice: "in_eur",
        payment: { type: "payment_intent", payment_intent: "pi_eur" },
      }),
    ],
    invoices: [
      paidInvoice(),
      paidInvoice({
        id: "in_eur",
        currency: "eur",
        subtotal: 1000,
        total: 1000,
        amount_paid: 1000,
      }),
    ],
    tenants: [tenant],
    period: october(),
  });
  assert.deepEqual(
    report.totalsByCurrency.map((total) => total.currency),
    ["RON", "EUR"],
  );
  const ron = report.totalsByCurrency[0];
  const eur = report.totalsByCurrency[1];
  assert.equal(ron.collected, 79);
  assert.equal(eur.collected, 10);
  assert.notEqual(ron.collected, 89);
  assert.equal(report.totalsByCurrency.some((total) => total.collected === 89), false);
});

test("13: lipsa TVA nu inventează un procent", () => {
  assert.equal(taxMinorFromTotalTaxes(null), null);
  assert.equal(taxMinorFromTotalTaxes([]), null);
  const report = reportFor({
    invoices: [
      paidInvoice({
        subtotal: 10000,
        total: 12100,
        total_taxes: null,
      }),
    ],
  });
  assert.equal(report.rows[0].subtotal, 100);
  assert.equal(report.rows[0].total, 121);
  assert.equal(report.rows[0].tax, null);
  assert.notEqual(report.rows[0].tax, 21);

  const explicit = reportFor({
    invoices: [
      paidInvoice({
        subtotal: 6530,
        total: 7900,
        total_taxes: [{ amount: 1370 }],
      }),
    ],
  });
  assert.equal(explicit.rows[0].tax, 13.7);
});

test("14: miezul nopții Europe/Bucharest cade în luna contabilă corectă", () => {
  const octoberPeriod = october();
  assert.equal(octoberPeriod.timeZone, "Europe/Bucharest");
  assert.equal(
    octoberPeriod.startUnix,
    Date.parse("2026-09-30T21:00:00Z") / 1000,
  );
  assert.equal(
    octoberPeriod.endUnix,
    Date.parse("2026-10-31T22:00:00Z") / 1000,
  );

  const january = periodFromMonth("2026-01");
  assert.equal(january.ok, true);
  assert.equal(january.period.startUnix, Date.parse("2025-12-31T22:00:00Z") / 1000);
  assert.equal(january.period.endUnix, Date.parse("2026-01-31T22:00:00Z") / 1000);

  const justAfterMidnight = Date.parse("2026-09-30T21:30:00Z") / 1000;
  const stillSeptember = Date.parse("2026-09-30T20:30:00Z") / 1000;
  const inOctober = buildAccountingReport({
    charges: [
      charge({ id: "ch_oct", created: justAfterMidnight }),
      charge({ id: "ch_sep", created: stillSeptember, payment_intent: "pi_sep" }),
    ],
    invoicePayments: [],
    invoices: [],
    tenants: [],
    period: octoberPeriod,
  });
  assert.deepEqual(
    inOctober.rows.map((row) => row.paymentId),
    ["pi_paid / ch_oct"],
  );

  const september = periodFromMonth("2026-09");
  assert.equal(september.ok, true);
  const inSeptember = buildAccountingReport({
    charges: [
      charge({ id: "ch_oct", created: justAfterMidnight }),
      charge({ id: "ch_sep", created: stillSeptember, payment_intent: "pi_sep" }),
    ],
    invoicePayments: [],
    invoices: [],
    tenants: [],
    period: september.period,
  });
  assert.deepEqual(
    inSeptember.rows.map((row) => row.paymentId),
    ["pi_sep / ch_sep"],
  );

  const defaultMonth = parseAccountingQuery(
    new URLSearchParams(),
    new Date("2026-09-30T22:30:00Z"),
  );
  assert.equal(defaultMonth.ok, true);
  assert.equal(defaultMonth.period.from, "2026-10-01");
  assert.equal(currentMonthInBucharest(new Date("2026-09-30T22:30:00Z")), "2026-10");
});

test("15: XLSX conține foile Plati și Sumar, fără TVA inventat", () => {
  const report = buildAccountingReport({
    charges: [
      charge(),
      charge({
        id: "ch_eur",
        amount: 1000,
        currency: "eur",
        payment_intent: "pi_eur",
      }),
    ],
    invoicePayments: [
      paymentLink(),
      paymentLink({
        id: "inpay_eur",
        invoice: "in_eur",
        payment: { type: "payment_intent", payment_intent: "pi_eur" },
      }),
    ],
    invoices: [
      paidInvoice({ subtotal: 10000, total: 12100, total_taxes: null }),
      paidInvoice({
        id: "in_eur",
        currency: "eur",
        subtotal: 1000,
        total: 1000,
        total_taxes: [],
      }),
    ],
    tenants: [tenant],
    period: october(),
    generatedAt: new Date("2026-10-16T08:00:00Z"),
  });
  const workbook = buildAccountingWorkbook(report);
  assert.equal(workbook.subarray(0, 2).toString(), "PK");
  const files = unzipStore(workbook);
  const workbookXml = files.get("xl/workbook.xml");
  assert.match(workbookXml, /name="Plati"/);
  assert.match(workbookXml, /name="Sumar"/);
  const payments = files.get("xl/worksheets/sheet1.xml");
  assert.match(payments, /Data/);
  assert.match(payments, /Platit/);
  assert.match(payments, /PAID/);
  assert.match(payments, /<v>79<\/v>/);
  assert.doesNotMatch(payments, /<v>21<\/v>/);
  const summary = files.get("xl/worksheets/sheet2.xml");
  assert.match(summary, /2026-10-01/);
  assert.match(summary, /2026-10-31/);
  assert.match(summary, /Europe\/Bucharest/);
  assert.match(summary, />RON</);
  assert.match(summary, />EUR</);
  assert.doesNotMatch(summary, /<v>89<\/v>/);
});

test("17: generarea raportului nu execută niciun Stripe write", async () => {
  const period = october();
  const calls = [];
  const stripe = {
    charges: {
      list: async () => {
        calls.push("charges.list");
        return {
          data: [
            {
              id: "ch_live",
              amount: 7900,
              amount_refunded: 2000,
              currency: "ron",
              created: period.startUnix + 10,
              paid: true,
              status: "succeeded",
              customer: "cus_salon",
              payment_intent: "pi_live",
              refunds: {
                data: [{ id: "re_1", amount: 2000, status: "succeeded" }],
                has_more: false,
              },
            },
          ],
          has_more: false,
        };
      },
      create: async () => {
        calls.push("charges.create");
        throw new Error("write");
      },
    },
    invoicePayments: {
      list: async (params) => {
        calls.push(
          params.payment
            ? "invoicePayments.list:payment_intent"
            : "invoicePayments.list",
        );
        if (params.payment) return { data: [], has_more: false };
        return {
          data: [
            {
              id: "inpay_live",
              status: "paid",
              amount_paid: 7900,
              currency: "ron",
              created: period.startUnix + 10,
              invoice: "in_live",
              payment: { type: "payment_intent", payment_intent: "pi_live" },
              status_transitions: { paid_at: period.startUnix + 10 },
            },
          ],
          has_more: false,
        };
      },
    },
    invoices: {
      list: async () => {
        calls.push("invoices.list");
        return {
          data: [
            {
              id: "in_live",
              number: "F-9",
              status: "paid",
              currency: "ron",
              subtotal: 7900,
              total: 7900,
              total_taxes: null,
              parent: { subscription_details: { subscription: "sub_live" } },
              lines: { data: [], has_more: false },
            },
          ],
          has_more: false,
        };
      },
      retrieve: async () => {
        calls.push("invoices.retrieve");
        throw new Error("missing");
      },
      listLineItems: async () => {
        calls.push("invoices.listLineItems");
        return { data: [], has_more: false };
      },
      pay: async () => {
        calls.push("invoices.pay");
        throw new Error("write");
      },
    },
    refunds: {
      list: async () => {
        calls.push("refunds.list");
        return { data: [], has_more: false };
      },
      create: async () => {
        calls.push("refunds.create");
        throw new Error("write");
      },
    },
    subscriptions: {
      cancel: async () => {
        calls.push("subscriptions.cancel");
        throw new Error("write");
      },
      update: async () => {
        calls.push("subscriptions.update");
        throw new Error("write");
      },
    },
    customers: {
      update: async () => {
        calls.push("customers.update");
        throw new Error("write");
      },
    },
  };

  const collected = await readStripePayments(stripeAccountingClient(stripe), period);
  assert.equal(collected.charges.length, 1);
  assert.equal(collected.invoices[0].id, "in_live");
  assert.equal(collected.invoices[0].subscriptionId, "sub_live");
  assert.equal(collected.refunds.length, 0);
  assert.equal(collected.refundedMinorByChargeId, undefined);
  const untouched = buildAccountingReport({
    ...collected,
    tenants: [],
    period,
  });
  assert.equal(untouched.rows[0].paid, 79);
  assert.equal(untouched.rows[0].refunded, 0);
  assert.equal(untouched.rows[0].status, "PAID");
  assert.deepEqual(calls, [
    "charges.list",
    "refunds.list",
    "invoicePayments.list",
    "invoices.list",
  ]);
  assert.equal(calls.includes("refunds.create"), false);
  assert.equal(calls.includes("subscriptions.cancel"), false);
  assert.equal(calls.includes("customers.update"), false);
  assert.equal(calls.includes("invoices.pay"), false);

  const sources = [
    "lib/accounting/stripeRead.ts",
    "lib/accounting/loadReport.ts",
    "lib/accounting/http.ts",
    "lib/accounting/report.ts",
    "app/api/admin/accounting/route.ts",
    "app/api/admin/accounting/xlsx/route.ts",
    "app/admin/accounting/page.tsx",
  ].map(readRepo).join("\n");
  assert.match(readRepo("lib/accounting/http.ts"), /requirePlatformCreator\(/);
  assert.match(readRepo("app/admin/accounting/page.tsx"), /isPlatformCreatorEmail/);
  assert.doesNotMatch(sources, /refunds\.create|subscriptions\.cancel|invoices\.pay|customers\.update|charges\.create/);

  const normalized = normalizeStripeInvoice({
    id: "in_dahlia",
    payment_intent: "pi_not_on_invoice",
    charge: "ch_not_on_invoice",
    parent: { subscription_details: { subscription: "sub_from_parent" } },
    total_taxes: null,
    lines: {
      data: [
        {
          id: "il_1",
          description: "Pro",
          amount: 7900,
          pricing: { price_details: { price: "price_123" } },
        },
      ],
      has_more: false,
    },
  });
  assert.equal(normalized.subscriptionId, "sub_from_parent");
  assert.equal(normalized.lines[0].priceId, "price_123");
  assert.equal(normalized.total_taxes, null);
});

test("navigația Contabilitate este vizibilă doar pentru Platform Creator", () => {
  const owner = buildAdminNavItems({ role: "owner", actsAsBarber: false });
  assert.equal(owner.some((item) => item.href === "/admin/accounting"), false);
  const creator = buildAdminNavItems({
    role: "owner",
    actsAsBarber: false,
    accountingEnabled: true,
  });
  assert.equal(creator.some((item) => item.href === "/admin/accounting"), true);
  const barber = buildAdminNavItems({
    role: "barber",
    actsAsBarber: true,
    accountingEnabled: true,
  });
  assert.equal(barber.some((item) => item.href === "/admin/accounting"), false);
});

test("refund-urile trunchiate se adună prin refunds.list, tot read-only", async () => {
  const period = october();
  const calls = [];
  const client = {
    charges: {
      list: async () => ({
        data: [
          charge({
            created: period.startUnix + 5,
            amount_refunded: 7900,
            refunds: {
              data: [{ id: "re_embedded", amount: 7900, status: "succeeded" }],
              has_more: true,
            },
          }),
        ],
        has_more: false,
      }),
    },
    invoicePayments: {
      list: async () => ({ data: [], has_more: false }),
    },
    invoices: {
      list: async () => ({ data: [], has_more: false }),
      retrieve: async () => {
        throw new Error("no");
      },
      listLineItems: async () => ({ data: [], has_more: false }),
    },
    refunds: {
      list: async (params) => {
        calls.push(params.starting_after ?? null);
        assert.equal(params.created.gte, period.startUnix);
        assert.equal(params.created.lt, period.endUnix);
        assert.equal(params.charge, undefined);
        const created = period.startUnix + 100;
        if (!params.starting_after) {
          return {
            data: [
              refund({
                id: "re_a",
                amount: 2000,
                created,
              }),
            ],
            has_more: true,
          };
        }
        return {
          data: [
            refund({ id: "re_b", amount: 1500, created: created + 1 }),
            refund({ id: "re_c", amount: 500, status: "pending", created: created + 2 }),
          ],
          has_more: false,
        };
      },
    },
  };
  const collected = await readStripePayments(client, period);
  assert.deepEqual(calls, [null, "re_a"]);
  const report = buildAccountingReport({
    ...collected,
    tenants: [],
    period,
  });
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].paid, 79);
  assert.equal(report.rows[0].refunded, 35);
  assert.equal(report.rows[0].net, 44);
  assert.equal(report.rows[0].status, "PARTIALLY_REFUNDED");
});

test("plata din septembrie rămâne în septembrie, iar refund-ul reușit apare în octombrie", async () => {
  const september = monthPeriod("2026-09");
  const octoberPeriod = october();
  const paidAt = Date.parse("2026-09-15T07:00:00Z") / 1000;
  const refundedAt = Date.parse("2026-10-05T09:00:00Z") / 1000;
  const septCharge = charge({
    created: paidAt,
    amount_refunded: 7900,
    refunds: {
      data: [{ id: "re_oct", amount: 7900, status: "succeeded", created: refundedAt }],
      has_more: false,
    },
  });
  const octRefund = refund({
    id: "re_oct",
    amount: 7900,
    created: refundedAt,
    chargeId: "ch_paid",
    paymentIntentId: "pi_paid",
  });
  const invoice = paidInvoice({
    subtotal: 6530,
    total: 7900,
    total_taxes: [{ amount: 1370 }],
  });
  const calls = [];

  function inRange(unix, range) {
    return unix >= range.gte && unix < range.lt;
  }

  const client = {
    charges: {
      list: async (params) => {
        calls.push("charges.list");
        return {
          data: inRange(septCharge.created, params.created) ? [septCharge] : [],
          has_more: false,
        };
      },
      retrieve: async (id) => {
        calls.push(`charges.retrieve:${id}`);
        assert.equal(id, "ch_paid");
        return septCharge;
      },
    },
    invoicePayments: {
      list: async () => ({
        data: [
          paymentLink({
            created: paidAt,
            status_transitions: { paid_at: paidAt },
          }),
        ],
        has_more: false,
      }),
    },
    invoices: {
      list: async () => ({ data: [], has_more: false }),
      retrieve: async () => invoice,
      listLineItems: async () => ({ data: [], has_more: false }),
    },
    refunds: {
      list: async (params) => {
        calls.push("refunds.list");
        assert.equal(params.charge, undefined);
        return {
          data: inRange(octRefund.created, params.created) ? [octRefund] : [],
          has_more: false,
        };
      },
      create: async () => {
        calls.push("refunds.create");
        throw new Error("write");
      },
    },
  };

  const septemberCollected = await readStripePayments(client, september);
  const septemberReport = buildAccountingReport({
    ...septemberCollected,
    tenants: [tenant],
    period: september,
  });
  assert.equal(septemberReport.rows.length, 1);
  assert.equal(septemberReport.paymentCount, 1);
  assert.equal(septemberReport.rows[0].paidAt, "2026-09-15 10:00");
  assert.equal(septemberReport.rows[0].paid, 79);
  assert.equal(septemberReport.rows[0].refunded, 0);
  assert.equal(septemberReport.rows[0].net, 79);
  assert.equal(septemberReport.rows[0].status, "PAID");
  assert.equal(septemberReport.rows[0].tax, 13.7);
  assert.equal(septemberReport.rows[0].total, 79);
  assert.equal(septemberReport.rows[0].salon, "Salon Nord");
  assert.equal(septemberReport.rows[0].stripeInvoiceId, "in_paid");
  assert.equal(septemberReport.totalsByCurrency[0].collected, 79);
  assert.equal(septemberReport.totalsByCurrency[0].refunded, 0);
  assert.equal(septemberReport.totalsByCurrency[0].net, 79);
  assert.equal(calls.includes("charges.retrieve:ch_paid"), false);

  const octoberCollected = await readStripePayments(client, octoberPeriod);
  assert.deepEqual(
    octoberCollected.contextCharges.map((item) => item.id),
    ["ch_paid"],
  );
  const octoberReport = buildAccountingReport({
    ...octoberCollected,
    tenants: [tenant],
    period: octoberPeriod,
  });
  assert.equal(octoberReport.rows.length, 1);
  assert.equal(octoberReport.paymentCount, 0);
  assert.equal(octoberReport.rows[0].paidAt, "2026-10-05 12:00");
  assert.equal(octoberReport.rows[0].paid, 0);
  assert.equal(octoberReport.rows[0].refunded, 79);
  assert.equal(octoberReport.rows[0].net, -79);
  assert.equal(octoberReport.rows[0].status, "REFUNDED");
  assert.equal(octoberReport.rows[0].subtotal, null);
  assert.equal(octoberReport.rows[0].tax, null);
  assert.equal(octoberReport.rows[0].total, null);
  assert.equal(octoberReport.rows[0].salon, "Salon Nord");
  assert.equal(octoberReport.rows[0].stripeCustomerId, "cus_salon");
  assert.equal(octoberReport.rows[0].stripeInvoiceId, "in_paid");
  assert.equal(octoberReport.rows[0].stripeInvoiceNumber, "F-100");
  assert.equal(octoberReport.rows[0].paymentId, "pi_paid / ch_paid");
  assert.equal(octoberReport.rows[0].currency, "RON");
  assert.equal(octoberReport.totalsByCurrency.length, 1);
  assert.equal(octoberReport.totalsByCurrency[0].currency, "RON");
  assert.equal(octoberReport.totalsByCurrency[0].collected, 0);
  assert.equal(octoberReport.totalsByCurrency[0].refunded, 79);
  assert.equal(octoberReport.totalsByCurrency[0].net, -79);
  assert.equal(calls.includes("refunds.create"), false);

  const septemberAgain = buildAccountingReport({
    charges: [septCharge],
    contextCharges: [],
    refunds: [octRefund],
    invoicePayments: [paymentLink()],
    invoices: [invoice],
    tenants: [tenant],
    period: september,
  });
  assert.equal(septemberAgain.rows.length, 1);
  assert.equal(septemberAgain.rows[0].paid, 79);
  assert.equal(septemberAgain.rows[0].refunded, 0);
  assert.equal(septemberAgain.rows[0].net, 79);
  assert.equal(septemberAgain.rows[0].status, "PAID");
  assert.equal(septemberAgain.rows[0].tax, 13.7);

  const workbook = buildAccountingWorkbook(octoberReport);
  const files = unzipStore(workbook);
  const payments = files.get("xl/worksheets/sheet1.xml");
  assert.match(payments, /2026-10-05 12:00/);
  assert.match(payments, /<v>-79<\/v>/);
  assert.match(payments, /REFUNDED/);
  assert.match(payments, /pi_paid \/ ch_paid/);
  assert.match(files.get("xl/workbook.xml"), /name="Plati"/);
  assert.match(files.get("xl/workbook.xml"), /name="Sumar"/);
});

test("refund-urile parțiale din luni diferite nu se mută în luna plății", async () => {
  const september = monthPeriod("2026-09");
  const octoberPeriod = october();
  const november = monthPeriod("2026-11");
  const paidAt = Date.parse("2026-09-15T07:00:00Z") / 1000;
  const eurPaidAt = Date.parse("2026-09-16T07:00:00Z") / 1000;
  const octFirst = Date.parse("2026-10-05T09:00:00Z") / 1000;
  const octSecond = Date.parse("2026-10-20T09:00:00Z") / 1000;
  const novRefundAt = Date.parse("2026-11-03T08:00:00Z") / 1000;
  const eurRefundAt = Date.parse("2026-10-08T09:00:00Z") / 1000;
  const ronCharge = charge({ created: paidAt, amount_refunded: 6500 });
  const eurCharge = charge({
    id: "ch_eur",
    amount: 1000,
    currency: "eur",
    created: eurPaidAt,
    payment_intent: "pi_eur",
    customer: "cus_salon",
    amount_refunded: 400,
  });
  const allRefunds = [
    refund({ id: "re_oct_20", amount: 2000, created: octFirst }),
    refund({ id: "re_pending", amount: 900, status: "pending", created: octFirst + 10 }),
    refund({ id: "re_failed", amount: 800, status: "failed", created: octFirst + 20 }),
    refund({ id: "re_canceled", amount: 700, status: "canceled", created: octFirst + 30 }),
    refund({ id: "re_oct_15", amount: 1500, created: octSecond }),
    refund({ id: "re_nov", amount: 3000, created: novRefundAt }),
    refund({
      id: "re_eur",
      amount: 400,
      currency: "eur",
      created: eurRefundAt,
      chargeId: "ch_eur",
      paymentIntentId: "pi_eur",
    }),
  ];

  function inRange(unix, range) {
    return unix >= range.gte && unix < range.lt;
  }

  const client = {
    charges: {
      list: async (params) => ({
        data: [ronCharge, eurCharge].filter((item) => inRange(item.created, params.created)),
        has_more: false,
      }),
      retrieve: async (id) => [ronCharge, eurCharge].find((item) => item.id === id),
    },
    invoicePayments: {
      list: async () => ({ data: [], has_more: false }),
    },
    invoices: {
      list: async () => ({ data: [], has_more: false }),
      retrieve: async () => {
        throw new Error("no invoice");
      },
      listLineItems: async () => ({ data: [], has_more: false }),
    },
    refunds: {
      list: async (params) => ({
        data: allRefunds.filter((item) => inRange(item.created, params.created)),
        has_more: false,
      }),
    },
  };

  async function reportForPeriod(period) {
    const collected = await readStripePayments(client, period);
    return buildAccountingReport({
      ...collected,
      tenants: [tenant],
      period,
    });
  }

  const septemberReport = await reportForPeriod(september);
  assert.equal(septemberReport.rows.length, 2);
  assert.equal(septemberReport.rows.every((row) => row.status === "PAID"), true);
  assert.equal(septemberReport.rows.every((row) => row.refunded === 0), true);
  const ronSeptember = septemberReport.totalsByCurrency.find((total) => total.currency === "RON");
  const eurSeptember = septemberReport.totalsByCurrency.find((total) => total.currency === "EUR");
  assert.equal(ronSeptember.collected, 79);
  assert.equal(ronSeptember.refunded, 0);
  assert.equal(ronSeptember.net, 79);
  assert.equal(eurSeptember.collected, 10);
  assert.equal(eurSeptember.refunded, 0);
  assert.equal(eurSeptember.net, 10);

  const octoberReport = await reportForPeriod(octoberPeriod);
  assert.equal(octoberReport.paymentCount, 0);
  assert.equal(octoberReport.rows.length, 3);
  const ronRows = octoberReport.rows.filter((row) => row.currency === "RON");
  assert.deepEqual(
    ronRows.map((row) => row.refunded),
    [20, 15],
  );
  assert.deepEqual(
    ronRows.map((row) => row.paidAt),
    ["2026-10-05 12:00", "2026-10-20 12:00"],
  );
  assert.equal(ronRows.every((row) => row.paid === 0), true);
  assert.equal(ronRows.every((row) => row.status === "PARTIALLY_REFUNDED"), true);
  assert.equal(ronRows.every((row) => row.paymentId === "pi_paid / ch_paid"), true);
  assert.equal(ronRows.every((row) => row.tax === null), true);
  assert.deepEqual(
    ronRows.map((row) => row.net),
    [-20, -15],
  );
  const eurRow = octoberReport.rows.find((row) => row.currency === "EUR");
  assert.equal(eurRow.refunded, 4);
  assert.equal(eurRow.net, -4);
  assert.equal(eurRow.paid, 0);
  assert.equal(eurRow.paymentId, "pi_eur / ch_eur");
  assert.equal(eurRow.status, "PARTIALLY_REFUNDED");
  const ronOctober = octoberReport.totalsByCurrency.find((total) => total.currency === "RON");
  const eurOctober = octoberReport.totalsByCurrency.find((total) => total.currency === "EUR");
  assert.equal(octoberReport.totalsByCurrency.length, 2);
  assert.equal(ronOctober.collected, 0);
  assert.equal(ronOctober.refunded, 35);
  assert.equal(ronOctober.net, -35);
  assert.equal(eurOctober.collected, 0);
  assert.equal(eurOctober.refunded, 4);
  assert.equal(eurOctober.net, -4);

  const novemberReport = await reportForPeriod(november);
  assert.equal(novemberReport.rows.length, 1);
  assert.equal(novemberReport.rows[0].paidAt, "2026-11-03 10:00");
  assert.equal(novemberReport.rows[0].paid, 0);
  assert.equal(novemberReport.rows[0].refunded, 30);
  assert.equal(novemberReport.rows[0].net, -30);
  assert.equal(novemberReport.rows[0].currency, "RON");
  assert.equal(novemberReport.rows[0].status, "PARTIALLY_REFUNDED");
  assert.equal(novemberReport.rows[0].paymentId, "pi_paid / ch_paid");
  assert.equal(novemberReport.totalsByCurrency[0].refunded, 30);
  assert.equal(novemberReport.totalsByCurrency[0].net, -30);

  const septemberAfter = await reportForPeriod(september);
  assert.equal(septemberAfter.rows.length, 2);
  assert.deepEqual(
    septemberAfter.rows.map((row) => [row.currency, row.paid, row.refunded, row.status]),
    [
      ["RON", 79, 0, "PAID"],
      ["EUR", 10, 0, "PAID"],
    ],
  );
});

test("charge-urile duplicate nu produc două rânduri", () => {
  const report = reportFor({
    charges: [charge(), charge(), charge({ id: "ch_other", payment_intent: "pi_other" })],
    invoicePayments: [
      paymentLink(),
      paymentLink({
        id: "inpay_other",
        invoice: "in_paid",
        payment: { type: "payment_intent", payment_intent: "pi_other" },
      }),
    ],
  });
  assert.equal(report.paymentCount, 2);
  assert.equal(report.totalsByCurrency[0].collected, 158);
});

function unzipStore(buffer) {
  const files = new Map();
  let offset = 0;
  while (offset + 30 <= buffer.length) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) break;
    const method = buffer.readUInt16LE(offset + 8);
    const size = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString("utf8");
    const start = offset + 30 + nameLength + extraLength;
    if (method !== 0) throw new Error(`metoda zip ${method} nu e STORE`);
    files.set(name, buffer.subarray(start, start + size).toString("utf8"));
    offset = start + size;
  }
  return files;
}
