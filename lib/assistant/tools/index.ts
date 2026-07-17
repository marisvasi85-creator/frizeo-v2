import type { AssistantToolDefinition } from "../types";
import { listBookingsTool } from "./listBookings";
import { listServicesTool } from "./listServices";
import { popularServicesTool } from "./popularServices";
import { subscriptionStatusTool } from "./subscriptionStatus";

export const ASSISTANT_TOOLS: AssistantToolDefinition[] = [
  {
    name: "list_bookings",
    description:
      "Listează programările salonului pe o perioadă (azi, mâine, săptămâna asta sau un interval de date). Nu include programările anulate.",
    parameters: {
      type: "object",
      properties: {
        range: {
          type: "string",
          enum: ["today", "tomorrow", "week"],
          description: "Interval rapid. Implicit: today.",
        },
        from_date: {
          type: "string",
          description: "Dată start YYYY-MM-DD (opțional).",
        },
        to_date: {
          type: "string",
          description: "Dată end YYYY-MM-DD (opțional).",
        },
        barber_id: {
          type: "string",
          description: "Filtrează pe un frizer (doar owner/manager).",
        },
      },
    },
    execute: listBookingsTool,
  },
  {
    name: "list_services",
    description:
      "Listează serviciile frizerului/salonului. Prețul este opțional — poate lipsi.",
    parameters: {
      type: "object",
      properties: {
        barber_id: {
          type: "string",
          description: "Frizerul pentru care listezi serviciile (owner/manager).",
        },
        include_inactive: {
          type: "boolean",
          description: "Include și serviciile inactive. Implicit false.",
        },
      },
    },
    execute: listServicesTool,
  },
  {
    name: "popular_services",
    description:
      "Returnează cele mai populare servicii după numărul de programări confirmate pe o perioadă. Nu calculează încasări.",
    parameters: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "Câte zile în urmă (implicit 30, max 180).",
        },
        limit: {
          type: "number",
          description: "Câte servicii să returnezi (implicit 5, max 20).",
        },
        barber_id: {
          type: "string",
          description: "Filtrează pe un frizer (owner/manager).",
        },
      },
    },
    execute: popularServicesTool,
  },
  {
    name: "subscription_status",
    description:
      "Returnează statusul abonamentului Frizeo al salonului (plan, trial). Nu include încasări sau plăți de la clienți.",
    parameters: {
      type: "object",
      properties: {},
    },
    execute: subscriptionStatusTool,
  },
];

export function getAssistantTool(name: string) {
  return ASSISTANT_TOOLS.find((tool) => tool.name === name) ?? null;
}

export function getOpenAIToolDefinitions() {
  return ASSISTANT_TOOLS.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}
