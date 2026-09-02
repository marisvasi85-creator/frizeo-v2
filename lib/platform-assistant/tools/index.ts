import type { PlatformToolDefinition } from "../types";
import { billingWatchlistTool } from "./billingWatchlist";
import { dailyBriefingTool } from "./dailyBriefing";
import { deleteTenantTool } from "./deleteTenant";
import { extendTrialTool } from "./extendTrial";
import { healthCheckTool } from "./healthCheck";
import { listTenantsTool } from "./listTenants";
import { platformOverviewTool } from "./platformOverview";
import { sendTrialFollowupTool } from "./sendTrialFollowup";
import { setTenantPlanTool } from "./setTenantPlan";
import { smsUsageTool } from "./smsUsage";
import { tenantDetailTool } from "./tenantDetail";
import { addTenantNoteTool, listTenantNotesTool } from "./tenantNotes";
import { trialFollowupsTool } from "./trialFollowups";
import { dailyActionsTool } from "./dailyActions";
import { growthDashboardTool } from "./growthDashboard";
import { growthFunnelTool } from "./growthFunnel";
import { inactiveTenantsTool } from "./inactiveTenants";
import { reviewCandidatesTool } from "./reviewCandidates";
import { tenantTimelineTool } from "./tenantTimeline";

export const PLATFORM_ASSISTANT_TOOLS: PlatformToolDefinition[] = [
  {
    name: "daily_briefing",
    description:
      "Briefing zilnic pentru creator: programări azi/ieri, saloane noi, trial-uri care expiră (urgente ≤3 zile), past_due, health (fără frizer / fără servicii) + listă de acțiuni sugerate. Folosește-l pentru „ce am azi pe platformă”, „briefing”, „ce e de făcut azi”.",
    parameters: {
      type: "object",
      properties: {
        trial_days: {
          type: "number",
          description:
            "Câte zile înainte să listezi trial-urile (implicit 7, max 30).",
        },
      },
    },
    execute: dailyBriefingTool,
  },
  {
    name: "health_check",
    description:
      "Health check platformă sau pe un salon: fără frizer activ, fără servicii, past_due, trial expirat, fără telefon; pe un salon și fără programări. Pentru „health check”, „saloane problematice”, „ce e broken”.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nume salon (opțional)." },
        slug: { type: "string", description: "Slug salon (opțional)." },
        tenant_id: { type: "string", description: "ID tenant (opțional)." },
        issue: {
          type: "string",
          enum: [
            "no_active_barber",
            "no_active_services",
            "past_due",
            "trial_expired",
            "no_phone",
            "no_bookings_ever",
          ],
          description: "Filtrează un tip de problemă.",
        },
        limit: {
          type: "number",
          description: "Câte issue-uri să returnezi pe platformă (implicit 30).",
        },
      },
    },
    execute: healthCheckTool,
  },
  {
    name: "platform_overview",
    description:
      "Rezumat platformă Frizeo: număr saloane, frizeri activi, programări luna curentă, abonamente pe status (trial/active/past_due).",
    parameters: { type: "object", properties: {} },
    execute: platformOverviewTool,
  },
  {
    name: "list_tenants",
    description:
      "Listează / caută saloane (tenants) cu plan și status abonament. Poți filtra după query (nume/slug) sau subscription_status.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Caută în nume / slug / telefon.",
        },
        subscription_status: {
          type: "string",
          description: "Filtru status: trialing, active, past_due, canceled…",
        },
        limit: {
          type: "number",
          description: "Câte rezultate (implicit 20, max 50).",
        },
      },
    },
    execute: listTenantsTool,
  },
  {
    name: "tenant_detail",
    description:
      "Detaliu pe un salon: plan, Stripe (da/nu), frizeri, programări luna asta, email owner, note interne recente.",
    parameters: {
      type: "object",
      properties: {
        tenant_id: { type: "string", description: "ID tenant." },
        slug: { type: "string", description: "Slug public salon." },
        name: { type: "string", description: "Nume salon (căutare)." },
      },
    },
    execute: tenantDetailTool,
  },
  {
    name: "list_tenant_notes",
    description:
      "Listează notele interne (creator) pe un salon. Pentru „ce am notat pe X”, „note San Barbershop”.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nume salon." },
        slug: { type: "string", description: "Slug salon." },
        tenant_id: { type: "string", description: "ID tenant." },
        limit: {
          type: "number",
          description: "Câte note (implicit 20, max 50).",
        },
      },
    },
    execute: listTenantNotesTool,
  },
  {
    name: "add_tenant_note",
    description:
      "Adaugă o notă internă pe un salon (doar creator, fără efect Stripe). Pentru „notează pe X că…”, „salvează notă”.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nume salon." },
        slug: { type: "string", description: "Slug salon." },
        tenant_id: { type: "string", description: "ID tenant." },
        body: {
          type: "string",
          description: "Textul notei.",
        },
        note: {
          type: "string",
          description: "Alias pentru body.",
        },
      },
    },
    execute: addTenantNoteTool,
  },
  {
    name: "billing_watchlist",
    description:
      "Trial-uri care expiră în N zile + abonamente past_due (plăți restante).",
    parameters: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "Fereastră pentru trial-uri (implicit 14, max 60).",
        },
      },
    },
    execute: billingWatchlistTool,
  },
  {
    name: "sms_usage",
    description:
      "Contorizează consumul de SMS (trimise ok / eșuate) pe platformă sau pe un salon, pe ultimele N zile, opțional pe tip (booking/reminder/reschedule/cancel). Pentru „câte SMS-uri”, „consum SMS”, „SMS San Barbershop”.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nume salon (opțional)." },
        slug: { type: "string", description: "Slug salon (opțional)." },
        tenant_id: { type: "string", description: "ID tenant (opțional)." },
        days: {
          type: "number",
          description: "Fereastră în zile (implicit 30, max 90).",
        },
        sms_type: {
          type: "string",
          enum: ["booking", "reminder", "reschedule", "cancel"],
          description: "Filtru tip SMS (opțional).",
        },
        type: {
          type: "string",
          description: "Alias pentru sms_type.",
        },
      },
    },
    execute: smsUsageTool,
  },
  {
    name: "trial_followups",
    description:
      "Listează follow-up trial (email owner + draft). NU trimite email. Pentru trimitere reală folosește send_trial_followup.",
    parameters: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "Fereastră (implicit 7, max 30).",
        },
        include_drafts: {
          type: "boolean",
          description: "Include draft mesaj email (implicit true).",
        },
      },
    },
    execute: trialFollowupsTool,
  },
  {
    name: "send_trial_followup",
    description:
      "DOAR CREATOR: trimite email REAL de follow-up trial (SMTP). Poți ținti un salon (name/slug) sau toate din fereastră (days). IMPORTANT: prima dată fără confirmed; după „da”, confirmed=true.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nume salon (opțional)." },
        slug: { type: "string", description: "Slug salon (opțional)." },
        tenant_id: { type: "string", description: "ID tenant (opțional)." },
        days: {
          type: "number",
          description:
            "Dacă nu specifici salon: fereastră trial (implicit 7).",
        },
        body: {
          type: "string",
          description: "Mesaj custom (altfel draft standard).",
        },
        confirmed: {
          type: "boolean",
          description: "true doar după confirmarea creatorului.",
        },
      },
    },
    execute: sendTrialFollowupTool,
  },
  {
    name: "set_tenant_plan",
    description:
      "DOAR CREATOR: setează manual planul unui salon în Frizeo (complimentary / override). NU încasează bani în Stripe. IMPORTANT: prima dată fără confirmed; după confirmare, confirmed=true. Implicit detașează stripe_subscription_id ca webhook-ul să nu rescrie planul.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Nume salon (ex: San Barbershop).",
        },
        slug: { type: "string", description: "Slug salon." },
        tenant_id: { type: "string", description: "ID tenant." },
        plan_slug: {
          type: "string",
          enum: ["free", "pro", "pro-plus", "custom"],
          description: "Planul țintă.",
        },
        plan: {
          type: "string",
          description: "Alias pentru plan_slug (pro / pro-plus / free / custom).",
        },
        detach_stripe: {
          type: "boolean",
          description:
            "Implicit true: șterge stripe_subscription_id din Frizeo. false = păstrează legătura Stripe (risc overwrite).",
        },
        reason: {
          type: "string",
          description: "Motiv scurt (ex: complimentary beta).",
        },
        confirmed: {
          type: "boolean",
          description: "true doar după confirmarea explicită a creatorului.",
        },
      },
      required: ["plan_slug"],
    },
    execute: setTenantPlanTool,
  },
  {
    name: "extend_trial",
    description:
      "DOAR CREATOR: prelungește trial_ends_at cu N zile (doar în Frizeo, fără plată Stripe). IMPORTANT: prima dată fără confirmed; după „da”, confirmed=true.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Nume salon.",
        },
        slug: { type: "string", description: "Slug salon." },
        tenant_id: { type: "string", description: "ID tenant." },
        days: {
          type: "number",
          description: "Zile de prelungire (implicit 7, max 90).",
        },
        reason: {
          type: "string",
          description: "Motiv scurt.",
        },
        confirmed: {
          type: "boolean",
          description: "true doar după confirmarea explicită a creatorului.",
        },
      },
    },
    execute: extendTrialTool,
  },
  {
    name: "delete_tenant",
    description:
      "DOAR CREATOR: șterge DEFINITIV un salon (DB + storage + opțional Auth users fără alte saloane + cancel Stripe). PERICULOS. IMPORTANT: 1) fără confirmed 2) după confirmare: confirmed=true + confirm_slug exact slug-ul salonului.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nume salon." },
        slug: { type: "string", description: "Slug salon." },
        tenant_id: { type: "string", description: "ID tenant." },
        confirm_slug: {
          type: "string",
          description:
            "Obligatoriu la confirmed=true: trebuie să coincidă cu slug-ul salonului.",
        },
        cancel_stripe: {
          type: "boolean",
          description: "Implicit true: anulează stripe_subscription_id dacă există.",
        },
        delete_auth_users: {
          type: "boolean",
          description:
            "Implicit true: șterge Auth users care nu mai aparțin altui salon (nu șterge creatorul Frizeo).",
        },
        confirmed: {
          type: "boolean",
          description: "true doar după confirmarea explicită a creatorului.",
        },
      },
    },
    execute: deleteTenantTool,
  },
  {
    name: "growth_dashboard",
    description:
      "Dashboard de creștere (read-only): saloane noi, onboarding, prima programare, trial active/expirate, conversii trial → Pro, past_due, owneri activi + recomandări. Pentru „cum stăm astăzi”, „ultimele 7 zile”, „ultimele 30 zile”.",
    parameters: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "Fereastră (implicit 7, max 90). 1 = azi.",
        },
      },
    },
    execute: growthDashboardTool,
  },
  {
    name: "inactive_tenants",
    description:
      "Saloane fără activitate (read-only): 0 programări, fără login X zile, fără servicii/program, trial aproape expirat / expirat. Include owner, email, telefon, motiv și sugestie de follow-up. Pentru „cine nu a făcut nicio programare”, „cine nu a mai intrat”.",
    parameters: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          enum: [
            "zero_bookings",
            "no_login",
            "no_services",
            "no_schedule",
            "trial_ending_soon",
            "trial_expired",
          ],
          description: "Filtru. Omite pentru toți inactivi, sortați pe urgență.",
        },
        days: {
          type: "number",
          description: "Pentru no_login: câte zile fără login (implicit 14).",
        },
        limit: {
          type: "number",
          description: "Câte saloane (implicit 20, max 50).",
        },
      },
    },
    execute: inactiveTenantsTool,
  },
  {
    name: "growth_funnel",
    description:
      "Funnel de conversie (read-only): Signup → onboarding → servicii → program → prima programare → trial/Pro → Pro. Identifică etapa cu cel mai mare abandon. Pentru „unde pierdem utilizatori”.",
    parameters: { type: "object", properties: {} },
    execute: growthFunnelTool,
  },
  {
    name: "tenant_timeline",
    description:
      "Timeline cronologic pe un salon (read-only): cont creat, login, servicii, program, prima/ultima programare, trial, conversie Pro, ultima actualizare plan. Pentru „ce a făcut X”, „istoria salonului”.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nume salon." },
        slug: { type: "string", description: "Slug salon." },
        tenant_id: { type: "string", description: "ID tenant." },
      },
    },
    execute: tenantTimelineTool,
  },
  {
    name: "review_candidates",
    description:
      "Găsește saloanele cele mai potrivite pentru un review Frizeo (read-only) și generează draft de email personalizat. NU trimite email. Criterii: uz activ, programări, login recent, fără probleme, convertit sau fidel. Pentru „cine merită un review”, „draft review”.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Câți candidați (implicit 8, max 20).",
        },
        include_drafts: {
          type: "boolean",
          description: "Include draft email (implicit true). Nu trimite.",
        },
      },
    },
    execute: reviewCandidatesTool,
  },
  {
    name: "daily_actions",
    description:
      "Plan de acțiuni de GROWTH pentru azi (read-only), prioritizat: trial care expiră, inactivi, abandon, past_due, candidați review. Pentru „Ce trebuie să fac astăzi?”, „ce acțiuni de creștere”. Nu înlocuiește daily_briefing (ops/health).",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Câte acțiuni (implicit 12, max 25).",
        },
      },
    },
    execute: dailyActionsTool,
  },
];

export function getPlatformTool(name: string) {
  return PLATFORM_ASSISTANT_TOOLS.find((t) => t.name === name) ?? null;
}

export function getPlatformOpenAIToolDefinitions() {
  return PLATFORM_ASSISTANT_TOOLS.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}
