import { getAppUrl } from "@/lib/app/getAppUrl";
import { sendEmail } from "@/lib/email/email";
import { barberInvitationTemplate } from "@/lib/email/templates/barber-invitation";
import {
  canInviteBarber,
  getBarberLimitState,
  inviteLimitReachedMessage,
  invitesNotAvailableOnPlanMessage,
} from "@/lib/limits/checkBarberLimit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { randomUUID } from "crypto";
import type { AssistantToolContext, AssistantToolResult } from "../types";
import { asBoolean, asString } from "./helpers";

function inviteDraft(input: {
  barberName: string;
  salonName: string;
  email: string;
  inviteUrl?: string;
}) {
  return {
    subject: "Invitație Frizeo",
    body: `Salut, ${input.barberName}!

Te invit în echipa ${input.salonName} pe Frizeo, ca să-ți vezi programările și programul.

${input.inviteUrl ? `Acceptă aici: ${input.inviteUrl}` : "Link-ul de acceptare se generează la trimitere."}

${input.salonName}`,
    to: input.email,
  };
}

export async function inviteBarberTool(
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  if (ctx.role === "barber") {
    return {
      ok: false,
      summary:
        "Doar owner-ul (sau managerul) poate invita frizeri. Cere-i să o facă din /admin/barbers sau din Assistant.",
      error: "forbidden",
    };
  }

  const fullName = asString(args.full_name) || asString(args.name);
  const email = asString(args.email)?.toLowerCase();
  const phone = asString(args.phone);
  const confirmed = asBoolean(args.confirmed);

  const state = await getBarberLimitState(ctx.tenantId);
  if (!state) {
    return {
      ok: false,
      summary: "Nu am putut citi planul pentru invitații.",
      error: "no_plan",
    };
  }

  if (!fullName || !email) {
    return {
      ok: true,
      summary: state.invitesAllowed
        ? `Poți invita frizeri pe ${state.planName || "planul actual"}. Îți mai rămân ${
            state.invitesLeft == null ? "nelimitat" : state.invitesLeft
          } loc(uri). Dă-mi numele și email-ul.`
        : `Pe ${state.planName || "planul actual"} nu poți invita frizeri (doar Pro+ / trial salon / Custom). Vezi /admin/barbers și /admin/billing.`,
      data: {
        invites_allowed: state.invitesAllowed,
        invites_left: state.invitesLeft,
        plan_name: state.planName,
        admin_path: "/admin/barbers",
      },
    };
  }

  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("name")
    .eq("id", ctx.tenantId)
    .maybeSingle();
  const salonName = tenant?.name || "salonul";

  const allowed = await canInviteBarber(ctx.tenantId);
  const { data: existingInvite } = await supabaseAdmin
    .from("barber_invitations")
    .select("id")
    .eq("tenant_id", ctx.tenantId)
    .eq("email", email)
    .eq("accepted", false)
    .maybeSingle();

  if (!existingInvite && !allowed) {
    return {
      ok: false,
      summary: !state.invitesAllowed
        ? invitesNotAvailableOnPlanMessage(state.planName)
        : inviteLimitReachedMessage(state.limit ?? 0),
      error: "invite_not_allowed",
      data: { admin_path: "/admin/barbers" },
    };
  }

  const draft = inviteDraft({
    barberName: fullName,
    salonName,
    email,
  });

  if (!confirmed) {
    return {
      ok: true,
      summary: `Confirmare necesară: trimit invitație către ${fullName} (${email}).`,
      data: {
        needs_confirmation: true,
        action: "invite_barber",
        proposal: {
          full_name: fullName,
          email,
          phone,
          plan_name: state.planName,
          invites_left: state.invitesLeft,
          draft,
        },
        instruct_user:
          "Arată draft-ul. Utilizatorul confirmă din butoane. Nu seta confirmed=true.",
      },
    };
  }

  const token = randomUUID();
  if (existingInvite) {
    const { error } = await supabaseAdmin
      .from("barber_invitations")
      .update({ token, full_name: fullName, phone })
      .eq("id", existingInvite.id);
    if (error) {
      return {
        ok: false,
        summary: "Nu am putut actualiza invitația.",
        error: error.message,
      };
    }
  } else {
    const { error } = await supabaseAdmin.from("barber_invitations").insert({
      tenant_id: ctx.tenantId,
      full_name: fullName,
      email,
      phone,
      token,
    });
    if (error) {
      return {
        ok: false,
        summary: "Nu am putut salva invitația.",
        error: error.message,
      };
    }
  }

  const inviteUrl = `${getAppUrl()}/accept-invite/${token}`;
  const html = barberInvitationTemplate({
    barberName: fullName,
    salonName,
    inviteUrl,
  });

  try {
    await sendEmail({
      to: email,
      subject: "Invitație Frizeo",
      html,
    });
  } catch (err) {
    return {
      ok: false,
      summary: `Invitația e salvată, dar email-ul a eșuat: ${
        err instanceof Error ? err.message : "send failed"
      }. Link: ${inviteUrl}`,
      error: "email_failed",
      data: { invite_url: inviteUrl },
    };
  }

  return {
    ok: true,
    summary: `Am trimis invitația către ${fullName} (${email}).`,
    data: { email, full_name: fullName, invite_url: inviteUrl },
  };
}
