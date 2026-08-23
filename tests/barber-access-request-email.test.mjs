import assert from "node:assert/strict";
import test from "node:test";
import { getAppUrlForRequest } from "../lib/app/getAppUrl.ts";
import {
  BARBER_ACCESS_REQUEST_SUBJECT,
  accessRequestDashboardUrl,
  attemptAccessRequestNotification,
  barberAccessRequestEmailHtml,
  deliverAccessRequestEmail,
  shouldNotifyAccessRequest,
} from "../lib/barber-access/requestNotification.ts";

const requestInput = {
  barberId: "barber-b",
  appUrl: "https://staging.frizeo.ro",
  clientName: "Ana Client",
  clientPhone: "0745 123 456",
  clientEmail: "ana@example.com",
  referral: "Recomandată de Ion",
  message: "Aș dori o programare.",
};

test("only a genuinely new pending request is eligible for notification", () => {
  assert.equal(
    shouldNotifyAccessRequest({ created: true, status: "pending" }),
    true,
  );

  for (const event of [
    { created: false, status: "pending" },
    { created: true, status: "approved" },
    { created: true, status: "rejected" },
    { created: true, status: "blocked" },
    { created: false, status: null },
  ]) {
    assert.equal(shouldNotifyAccessRequest(event), false);
  }
});

test("duplicates, existing statuses and invalid requests do not call the sender", async () => {
  let calls = 0;
  const notify = async () => {
    calls += 1;
  };

  for (const event of [
    { created: false, status: "pending" },
    { created: false, status: "approved" },
    { created: false, status: "blocked" },
    { created: false, status: null },
  ]) {
    assert.equal(
      await attemptAccessRequestNotification(event, notify, () => {}),
      false,
    );
  }

  assert.equal(calls, 0);
});

test("email failure is reported without escaping the notification boundary", async () => {
  const failure = new Error("SMTP unavailable");
  let reportedError;

  const result = await attemptAccessRequestNotification(
    { created: true, status: "pending" },
    async () => {
      throw failure;
    },
    (error) => {
      reportedError = error;
    },
  );

  assert.equal(result, false);
  assert.equal(reportedError, failure);
});

test("the requested barber alone is resolved and receives the branded email", async () => {
  const resolvedBarbers = [];
  const sentPayloads = [];

  const result = await deliverAccessRequestEmail(requestInput, {
    resolveRecipient: async (barberId) => {
      resolvedBarbers.push(barberId);
      return {
        email: "barber-b@frizeo.test",
        displayName: "Frizer B",
      };
    },
    send: async (payload) => {
      sentPayloads.push(payload);
    },
  });

  assert.equal(result, true);
  assert.deepEqual(resolvedBarbers, ["barber-b"]);
  assert.equal(sentPayloads.length, 1);
  assert.equal(sentPayloads[0].to, "barber-b@frizeo.test");
  assert.equal(sentPayloads[0].subject, BARBER_ACCESS_REQUEST_SUBJECT);
  assert.match(sentPayloads[0].html, /Vezi cererea în Frizeo/);
  assert.doesNotMatch(sentPayloads[0].html, /barber-a@frizeo\.test/);
});

test("the CTA stays on staging and opens the exact barber pending filter", () => {
  assert.equal(
    accessRequestDashboardUrl("barber-b", "https://staging.frizeo.ro"),
    "https://staging.frizeo.ro/admin/client-access?barberId=barber-b&status=pending",
  );
  assert.equal(
    getAppUrlForRequest(
      "https://staging.frizeo.ro/api/public/barber-access/request",
    ),
    "https://staging.frizeo.ro",
  );
});

test("optional request fields appear only when supplied and are escaped", () => {
  const dashboardUrl = accessRequestDashboardUrl(
    "barber-b",
    "https://staging.frizeo.ro",
  );
  const withoutOptionalFields = barberAccessRequestEmailHtml({
    barberName: null,
    dashboardUrl,
    clientName: "Ana Client",
    clientPhone: "0745 123 456",
    clientEmail: null,
    referral: null,
    message: null,
  });

  assert.doesNotMatch(withoutOptionalFields, /<strong>Email:<\/strong>/);
  assert.doesNotMatch(withoutOptionalFields, /<strong>Recomandare:<\/strong>/);
  assert.doesNotMatch(withoutOptionalFields, /<strong>Mesaj:<\/strong>/);
  assert.match(withoutOptionalFields, /barberId=barber-b&amp;status=pending/);

  const withOptionalFields = barberAccessRequestEmailHtml({
    barberName: "Frizer <B>",
    dashboardUrl,
    clientName: "Ana <Client>",
    clientPhone: "0745 123 456",
    clientEmail: "ana@example.com",
    referral: "Ion & Maria",
    message: "<script>alert('x')</script>",
  });

  assert.match(withOptionalFields, /<strong>Email:<\/strong> ana@example\.com/);
  assert.match(
    withOptionalFields,
    /<strong>Recomandare:<\/strong> Ion &amp; Maria/,
  );
  assert.match(withOptionalFields, /Frizer &lt;B&gt;/);
  assert.match(withOptionalFields, /Ana &lt;Client&gt;/);
  assert.doesNotMatch(withOptionalFields, /<script>/);
});

test("a missing canonical barber email prevents sending", async () => {
  let sendCalls = 0;

  const result = await deliverAccessRequestEmail(requestInput, {
    resolveRecipient: async () => null,
    send: async () => {
      sendCalls += 1;
    },
  });

  assert.equal(result, false);
  assert.equal(sendCalls, 0);
});
