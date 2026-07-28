import { supabaseAdmin } from "@/lib/supabase/admin";
import { hasSmsSendsTable } from "@/lib/sms/usage";
import {
  createPage,
  findPageByTitleEquals,
  getSmsUsageDatabaseId,
  numberProp,
  richTextProp,
  selectProp,
  titleProp,
  updatePage,
  dateProp,
} from "@/lib/notion/client";

export type SmsDayAggregate = {
  usage_date: string;
  total: number;
  ok: number;
  failed: number;
  reminder: number;
  booking: number;
  reschedule: number;
  cancel: number;
};

function emptyAggregate(usageDate: string): SmsDayAggregate {
  return {
    usage_date: usageDate,
    total: 0,
    ok: 0,
    failed: 0,
    reminder: 0,
    booking: 0,
    reschedule: 0,
    cancel: 0,
  };
}

export async function aggregateSmsUsage(params: {
  fromDate: string;
  toDate: string;
}): Promise<SmsDayAggregate[]> {
  if (!(await hasSmsSendsTable())) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("sms_sends")
    .select("usage_date, ok, sms_type")
    .gte("usage_date", params.fromDate)
    .lte("usage_date", params.toDate);

  if (error) {
    throw new Error(`sms_sends query failed: ${error.message}`);
  }

  const byDate = new Map<string, SmsDayAggregate>();

  for (const row of data ?? []) {
    const day = String(row.usage_date).slice(0, 10);
    const agg = byDate.get(day) ?? emptyAggregate(day);
    agg.total += 1;
    if (row.ok) agg.ok += 1;
    else agg.failed += 1;

    switch (row.sms_type) {
      case "reminder":
        agg.reminder += 1;
        break;
      case "booking":
        agg.booking += 1;
        break;
      case "reschedule":
        agg.reschedule += 1;
        break;
      case "cancel":
        agg.cancel += 1;
        break;
      default:
        break;
    }

    byDate.set(day, agg);
  }

  return [...byDate.values()].sort((a, b) =>
    a.usage_date.localeCompare(b.usage_date),
  );
}

function smsRowTitle(usageDate: string): string {
  return `SMS ${usageDate}`;
}

function smsProperties(agg: SmsDayAggregate) {
  return {
    Name: titleProp(smsRowTitle(agg.usage_date)),
    Date: dateProp(agg.usage_date),
    Total: numberProp(agg.total),
    OK: numberProp(agg.ok),
    Failed: numberProp(agg.failed),
    Reminder: numberProp(agg.reminder),
    Booking: numberProp(agg.booking),
    Reschedule: numberProp(agg.reschedule),
    Cancel: numberProp(agg.cancel),
    Source: selectProp("sync"),
    Notes: richTextProp(`Synced from Frizeo sms_sends at ${new Date().toISOString()}`),
  };
}

export async function syncSmsUsageToNotion(params?: {
  daysBack?: number;
}): Promise<{
  synced: number;
  created: number;
  updated: number;
  days: string[];
}> {
  const databaseId = getSmsUsageDatabaseId();
  if (!databaseId) {
    throw new Error("NOTION_SMS_USAGE_DATABASE_ID is not configured");
  }

  const daysBack = Math.min(Math.max(params?.daysBack ?? 7, 1), 31);
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (daysBack - 1));

  const fromDate = from.toISOString().slice(0, 10);
  const toDate = to.toISOString().slice(0, 10);

  const aggregates = await aggregateSmsUsage({ fromDate, toDate });

  // Ensure today exists even with 0 sends (visibility in dashboard).
  if (!aggregates.some((a) => a.usage_date === toDate)) {
    aggregates.push(emptyAggregate(toDate));
  }

  let created = 0;
  let updated = 0;

  for (const agg of aggregates) {
    const title = smsRowTitle(agg.usage_date);
    const existing = await findPageByTitleEquals({
      databaseId,
      value: title,
    });
    const properties = smsProperties(agg);

    if (existing) {
      await updatePage({ pageId: existing.id, properties });
      updated += 1;
    } else {
      await createPage({ databaseId, properties });
      created += 1;
    }
  }

  return {
    synced: aggregates.length,
    created,
    updated,
    days: aggregates.map((a) => a.usage_date),
  };
}
