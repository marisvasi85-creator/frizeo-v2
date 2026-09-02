import { getAppUrl } from "@/lib/app/getAppUrl";
import {
  publicBookingUrl,
  publicSalonUrl,
  stableBookingUrl,
} from "@/lib/booking/publicBookingPath";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AssistantToolContext, AssistantToolResult } from "../types";
import { resolveBarberFromArgs } from "./helpers";

export async function bookingLinkTool(
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("name, slug")
    .eq("id", ctx.tenantId)
    .maybeSingle();

  if (!tenant?.slug) {
    return {
      ok: false,
      summary:
        "Salonul nu are slug public. Completează datele salonului din /admin/salon.",
      error: "missing_slug",
    };
  }

  const appUrl = getAppUrl();
  const salonUrl = publicSalonUrl(tenant.slug, appUrl);
  const salonPath = `/booking/salon/${tenant.slug}`;

  const wantsBarber =
    Boolean(args.barber_id) ||
    Boolean(args.barber_name) ||
    Boolean(args.barber) ||
    ctx.role === "barber" ||
    args.for_me === true;

  if (!wantsBarber && ctx.role !== "barber") {
    return {
      ok: true,
      summary: `Link public salon: ${salonUrl}. Clienții aleg frizerul pe pagină.`,
      data: {
        salon_name: tenant.name,
        salon_url: salonUrl,
        salon_path: salonPath,
        how_to_share:
          "Pune-l în Instagram bio, Google sau WhatsApp. Clienții aleg frizerul pe pagină.",
      },
    };
  }

  const resolved = await resolveBarberFromArgs(ctx, args);
  if (!resolved.ok) return resolved.result;

  const { data: barber } = await supabaseAdmin
    .from("barbers")
    .select("id, display_name, slug, google_calendar_connected, active")
    .eq("id", resolved.barberId)
    .maybeSingle();

  if (!barber?.active) {
    return {
      ok: false,
      summary: "Frizerul nu e activ — link-ul de programare nu e public.",
      error: "inactive_barber",
    };
  }

  const prettyUrl = barber.slug
    ? publicBookingUrl(tenant.slug, barber.slug, appUrl)
    : stableBookingUrl(barber.id, appUrl);

  return {
    ok: true,
    summary: `Link pentru ${barber.display_name}: ${prettyUrl}`,
    data: {
      salon_name: tenant.name,
      barber_name: barber.display_name,
      barber_url: prettyUrl,
      salon_url: salonUrl,
      stable_url: stableBookingUrl(barber.id, appUrl),
      google_calendar_connected: Boolean(barber.google_calendar_connected),
      how_to_share:
        "Trimite acest link clientului. Programările apar automat în admin și, dacă Google e conectat, în calendar.",
    },
  };
}
