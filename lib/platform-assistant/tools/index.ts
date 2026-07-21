import type { PlatformToolDefinition } from "../types";
import { billingWatchlistTool } from "./billingWatchlist";
import { listTenantsTool } from "./listTenants";
import { platformOverviewTool } from "./platformOverview";
import { tenantDetailTool } from "./tenantDetail";

export const PLATFORM_ASSISTANT_TOOLS: PlatformToolDefinition[] = [
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
      "Detaliu pe un salon: plan, Stripe (da/nu), frizeri, programări luna asta, email owner.",
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
