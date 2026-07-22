import type { PublicToolDefinition } from "../types";
import { findSlotsTool } from "./findSlots";
import { listBarbersTool } from "./listBarbers";
import { listServicesTool } from "./listServices";
import { salonInfoTool } from "./salonInfo";

export const PUBLIC_ASSISTANT_TOOLS: PublicToolDefinition[] = [
  {
    name: "salon_info",
    description:
      "Info publice despre salon: telefon, adresă, descriere. Pentru „unde sunteți”, „care e telefonul”.",
    parameters: { type: "object", properties: {} },
    execute: salonInfoTool,
  },
  {
    name: "list_barbers",
    description:
      "Listează frizerii activi ai salonului cu link de programare.",
    parameters: { type: "object", properties: {} },
    execute: listBarbersTool,
  },
  {
    name: "list_services",
    description:
      "Listează serviciile active (durată + preț dacă e public). Implicit pe frizerul curent, altfel tot salonul.",
    parameters: {
      type: "object",
      properties: {
        barber_slug: { type: "string" },
        barber_name: { type: "string" },
      },
    },
    execute: listServicesTool,
  },
  {
    name: "find_slots",
    description:
      "Ore libere pentru o zi. Folosește when=today|tomorrow sau date=YYYY-MM-DD. Poți specifica service_name și barber.",
    parameters: {
      type: "object",
      properties: {
        when: {
          type: "string",
          enum: ["today", "tomorrow"],
        },
        date: { type: "string", description: "YYYY-MM-DD" },
        service_name: { type: "string" },
        service_id: { type: "string" },
        barber_slug: { type: "string" },
        barber_name: { type: "string" },
        limit: { type: "number" },
      },
    },
    execute: findSlotsTool,
  },
];

export function getPublicTool(name: string) {
  return PUBLIC_ASSISTANT_TOOLS.find((t) => t.name === name) ?? null;
}

export function getPublicOpenAIToolDefinitions() {
  return PUBLIC_ASSISTANT_TOOLS.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}
