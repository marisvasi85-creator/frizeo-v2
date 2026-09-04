import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const expected = [
  ["welcome_after_signup", "user_signed_up", 0, "welcome_ready"],
  [
    "check_schedule_services_after_signup",
    "user_signed_up",
    1440,
    "check_schedule_services",
  ],
  [
    "share_booking_link_after_signup",
    "user_signed_up",
    2880,
    "share_booking_link",
  ],
  [
    "google_visibility_after_signup",
    "user_signed_up",
    4320,
    "google_visibility",
  ],
  [
    "incomplete_onboarding_after_signup",
    "user_signed_up",
    1440,
    "incomplete_onboarding",
  ],
  [
    "no_first_booking",
    "user_signed_up",
    10080,
    "no_first_booking",
  ],
  [
    "google_calendar_after_signup",
    "user_signed_up",
    7200,
    "connect_google_calendar",
  ],
  [
    "invite_team_after_signup",
    "user_signed_up",
    10080,
    "invite_team",
  ],
  ["inactive_account", "account_inactive", 0, "inactive_account"],
  [
    "review_after_10_bookings",
    "min_bookings",
    0,
    "review_request_active_user",
  ],
  ["trial_active_tips", "trial_started", 10080, "trial_use_it"],
  ["trial_ending_7_days", "trial_ending_7_days", 0, "trial_7_days"],
  ["trial_ending_3_days", "trial_ending_3_days", 0, "trial_3_days"],
  ["trial_last_day", "trial_last_day", 0, "trial_last_day"],
  ["trial_expired", "trial_expired", 1440, "trial_expired"],
  ["trial_expired_7_days", "trial_expired", 10080, "winback_7_days"],
  ["subscription_activated", "subscription_activated", 0, "subscription_active"],
];

const scheduleTs = readFileSync(
  new URL("../lib/frizeo-email/automationSchedule.ts", import.meta.url),
  "utf8",
);
const phase6Sql = readFileSync(
  new URL(
    "../supabase/migrations/20260810140000_frizeo_email_phase6_automations.sql",
    import.meta.url,
  ),
  "utf8",
);
const googleSql = readFileSync(
  new URL(
    "../supabase/migrations/20260819150000_google_visibility_after_signup_automation.sql",
    import.meta.url,
  ),
  "utf8",
);
const activationSql = readFileSync(
  new URL(
    "../supabase/migrations/20260902120000_activation_marketing_automations.sql",
    import.meta.url,
  ),
  "utf8",
);
const reviewSql = readFileSync(
  new URL(
    "../supabase/migrations/20260904120000_review_request_after_10_bookings.sql",
    import.meta.url,
  ),
  "utf8",
);
const activationLinksSql = readFileSync(
  new URL(
    "../supabase/migrations/20260902140000_activation_email_account_links.sql",
    import.meta.url,
  ),
  "utf8",
);
const fixSql = readFileSync(
  new URL(
    "../supabase/migrations/20260828120000_fix_automation_trial_calendar_and_claim.sql",
    import.meta.url,
  ),
  "utf8",
);
const catchupSql = readFileSync(
  new URL(
    "../supabase/migrations/20260828140000_fix_automation_catchup_primary_contact.sql",
    import.meta.url,
  ),
  "utf8",
);
const workerTs = readFileSync(
  new URL("../lib/frizeo-email/automationWorker.ts", import.meta.url),
  "utf8",
);

function seedSqlFor(automationKey) {
  if (automationKey.startsWith("google_visibility")) return googleSql;
  if (automationKey === "review_after_10_bookings") return reviewSql;
  if (
    [
      "incomplete_onboarding_after_signup",
      "inactive_account",
      "no_first_booking",
      "google_calendar_after_signup",
      "invite_team_after_signup",
    ].includes(automationKey)
  ) {
    return activationSql;
  }
  return phase6Sql;
}

test("system automations map each day to the expected template", () => {
  for (const [automationKey, trigger, delay, templateKey] of expected) {
    const tsBlock = new RegExp(
      `automation_key: "${automationKey}"[\\s\\S]{0,400}trigger_type: "${trigger}"[\\s\\S]{0,200}delay_minutes: ${delay}[\\s\\S]{0,200}template_key: "${templateKey}"`,
    );
    assert.match(
      scheduleTs,
      tsBlock,
      `${automationKey} missing from automationSchedule.ts`,
    );

    const sql = seedSqlFor(automationKey);
    assert.match(
      sql,
      new RegExp(`'${automationKey}'[\\s\\S]{0,800}'${templateKey}'`),
      `${automationKey} → ${templateKey} missing from SQL seed`,
    );
    assert.match(
      sql,
      new RegExp(`'${automationKey}'[\\s\\S]{0,600}'${trigger}'`),
      `${automationKey} trigger ${trigger} missing from SQL seed`,
    );
  }
});

test("activation emails include account and booking links", () => {
  assert.match(activationLinksSql, /\{\{dashboard_url\}\}/);
  assert.match(activationLinksSql, /\{\{services_url\}\}/);
  assert.match(activationLinksSql, /\{\{schedule_url\}\}/);
  assert.match(activationLinksSql, /\{\{booking_link\}\}/);
  assert.match(activationLinksSql, /\{\{profile_url\}\}/);
  assert.match(activationLinksSql, /\{\{barbers_url\}\}/);
  assert.match(
    activationLinksSql,
    /WHERE template_key = 'incomplete_onboarding'/,
  );
  assert.match(
    activationLinksSql,
    /WHERE template_key = 'connect_google_calendar'/,
  );
  assert.match(activationLinksSql, /WHERE template_key = 'invite_team'/);
});

test("activation discover keeps trial catch-up and only skips activation runs", () => {
  assert.match(
    activationSql,
    /trigger_type = 'account_inactive'/,
  );
  assert.match(
    activationSql,
    /marketing_bucharest_date\(subscription\.trial_ends_at\) >= v_today \+ 4/,
  );
  assert.match(
    activationSql,
    /incomplete_onboarding_after_signup/,
  );
  assert.match(
    activationSql,
    /skip_reason = cond\.skip_reason/,
  );
  assert.match(
    activationSql,
    /automation\.automation_key IN \(/,
  );
});

test("trial countdown uses Bucharest calendar dates, not timestamptz::date", () => {
  assert.match(
    fixSql,
    /marketing_bucharest_date\(subscription\.trial_ends_at\) = v_today \+ 7/,
  );
  assert.match(
    fixSql,
    /marketing_bucharest_date\(subscription\.trial_ends_at\) = v_today \+ 3/,
  );
  assert.match(
    catchupSql,
    /marketing_bucharest_date\(subscription\.trial_ends_at\) >= v_today \+ 4/,
  );
  assert.match(
    catchupSql,
    /marketing_primary_contact_id\(contact\.tenant_id\)/,
  );
  assert.doesNotMatch(
    catchupSql,
    /AND public\.marketing_bucharest_date\(subscription\.trial_ends_at\) = v_today \+ 7/,
  );
});

test("claim loads one latest subscription so a run cannot be sent twice", () => {
  assert.match(fixSql, /LEFT JOIN LATERAL/);
  assert.match(fixSql, /ORDER BY latest\.created_at DESC NULLS LAST/);
  assert.match(fixSql, /JOIN public\.marketing_email_templates template/);
});

test("worker sends the claimed automation template, not a campaign body", () => {
  assert.match(workerTs, /contentFromClaim\(run\)/);
  assert.match(workerTs, /kind: "marketing-automation"/);
  assert.match(workerTs, /utmCampaign: run\.automation_key/);
});

test("segment facts use Bucharest trial dates and one latest subscription", () => {
  assert.match(
    catchupSql,
    /public\.marketing_bucharest_date\(subscription\.trial_ends_at\) = clock\.today \+ 7/,
  );
  assert.match(catchupSql, /LEFT JOIN LATERAL/);
});

test("trial ending at 00:30 Bucharest is a different UTC calendar day", () => {
  const trialEnd = new Date("2026-09-03T21:30:00.000Z");
  const utc = trialEnd.toISOString().slice(0, 10);
  const bucharest = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(trialEnd);
  assert.equal(utc, "2026-09-03");
  assert.equal(bucharest, "2026-09-04");
});

test("review after 10 bookings is paused, one-shot per tenant, excludes cancelled", () => {
  assert.match(reviewSql, /'review_request_active_user'/);
  assert.match(reviewSql, /https:\/\/staging\.frizeo\.ro\/review/);
  assert.match(reviewSql, /'Lasă-ne o recenzie'/);
  assert.match(reviewSql, /trigger_type = 'min_bookings'/);
  assert.match(reviewSql, /'min_bookings:' \|\| contact\.tenant_id::text/);
  assert.match(reviewSql, /booking\.status <> 'cancelled'/);
  assert.match(reviewSql, /ON CONFLICT \(automation_id, trigger_reference\) DO NOTHING/);
  assert.match(reviewSql, /'review_after_10_bookings'/);
  assert.match(reviewSql, /"min_bookings":10/);
  assert.match(
    reviewSql,
    /'review_after_10_bookings'[\s\S]{0,900}true,\s+false/,
  );
  assert.doesNotMatch(reviewSql, /review_request_sent_at/);
  assert.match(scheduleTs, /function describeAutomationTrigger/);
});
