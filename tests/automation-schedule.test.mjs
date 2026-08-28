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
const fixSql = readFileSync(
  new URL(
    "../supabase/migrations/20260828120000_fix_automation_trial_calendar_and_claim.sql",
    import.meta.url,
  ),
  "utf8",
);
const workerTs = readFileSync(
  new URL("../lib/frizeo-email/automationWorker.ts", import.meta.url),
  "utf8",
);

function seedSqlFor(automationKey) {
  return automationKey.startsWith("google_visibility") ? googleSql : phase6Sql;
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

test("trial countdown uses Bucharest calendar dates, not timestamptz::date", () => {
  assert.match(fixSql, /marketing_bucharest_date\(subscription\.trial_ends_at\) = v_today \+ 7/);
  assert.match(fixSql, /marketing_bucharest_date\(subscription\.trial_ends_at\) = v_today \+ 3/);
  assert.match(fixSql, /marketing_bucharest_date\(subscription\.trial_ends_at\) = v_today/);
  assert.doesNotMatch(
    fixSql,
    /AND subscription\.trial_ends_at::date = v_today \+ 7/,
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
