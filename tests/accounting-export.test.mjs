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
            { id: "re_ok", amount: 2000, status: "succeeded" },
            { id: "re_pending", amount: 5900, status: "pending" },
          ],
        },
      }),
    ],
  });
  assert.equal(partial.rows[0].paid, 79);
  assert.equal(partial.rows[0].refunded, 20);
  assert.equal(partial.rows[0].net, 59);
  assert.equal(partial.rows[0].status, "PARTIALLY_REFUNDED");
  assert.equal(partial.rows[0].total, 79);

  const full = reportFor({
    charges: [
      charge({
        refunds: {
          has_more: false,
          data: [{ id: "re_full", amount: 7900, status: "succeeded" }],
        },
      }),
    ],
  });
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
    charges: [
      charge({
        refunds: {
          has_more: false,
          data: [
            { amount: 3000, status: "succeeded" },
            { amount: 1500, status: "succeeded" },
            { amount: 400, status: "failed" },
          ],
        },
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
  assert.equal(collected.refundedMinorByChargeId.ch_live, 2000);
  assert.deepEqual(calls, ["charges.list", "invoicePayments.list", "invoices.list"]);
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
            refunds: { data: [{ id: "re_partial_page", amount: 1000, status: "succeeded" }], has_more: true },
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
        if (!params.starting_after) {
          return {
            data: [{ id: "re_a", amount: 2000, status: "succeeded" }],
            has_more: true,
          };
        }
        return {
          data: [
            { id: "re_b", amount: 1500, status: "succeeded" },
            { id: "re_c", amount: 500, status: "pending" },
          ],
          has_more: false,
        };
      },
    },
  };
  const collected = await readStripePayments(client, period);
  assert.deepEqual(calls, [null, "re_a"]);
  assert.equal(collected.refundedMinorByChargeId.ch_paid, 3500);
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
