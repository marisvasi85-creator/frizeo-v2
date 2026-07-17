import type { AssistantToolDefinition } from "../types";
import { cancelBookingTool } from "./cancelBooking";
import { createServiceTool } from "./createService";
import { listBookingsTool } from "./listBookings";
import { listServicesTool } from "./listServices";
import {
  getNextBookingTool,
  getTodayBriefingTool,
} from "./nextBooking";
import { popularServicesTool } from "./popularServices";
import { closeDayTool, createVacationTool } from "./scheduleTools";
import { subscriptionStatusTool } from "./subscriptionStatus";
import { updateBookingTool } from "./updateBooking";

export const ASSISTANT_TOOLS: AssistantToolDefinition[] = [
  {
    name: "today_briefing",
    description:
      "Briefing rapid pentru ziua de azi: câte programări, câte au trecut, câte rămân, cine e următorul client.",
    parameters: {
      type: "object",
      properties: {
        barber_id: {
          type: "string",
          description: "Frizer (owner/manager). Implicit profilul curent.",
        },
      },
    },
    execute: getTodayBriefingTool,
  },
  {
    name: "next_booking",
    description:
      "Returnează următoarea programare viitoare (client, oră, serviciu).",
    parameters: {
      type: "object",
      properties: {
        barber_id: {
          type: "string",
          description: "Frizer (owner/manager). Implicit profilul curent.",
        },
      },
    },
    execute: getNextBookingTool,
  },
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
          description:
            "Frizerul pentru care listezi serviciile (owner/manager).",
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
  {
    name: "create_service",
    description:
      "Adaugă un serviciu nou. Prețul este opțional. IMPORTANT: prima dată apelează fără confirmed; după confirmare, cu confirmed=true.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Numele serviciului (ex: Tuns clasic).",
        },
        duration_minutes: {
          type: "number",
          description:
            "Durata în minute. Valori tipice: 15,30,45,60,75,90,120.",
        },
        price_ron: {
          type: "number",
          description: "Preț opțional în lei. Poate lipsi.",
        },
        barber_id: {
          type: "string",
          description:
            "Frizerul (owner/manager). Pentru barber se folosește profilul curent.",
        },
        confirmed: {
          type: "boolean",
          description: "true doar după confirmarea explicită a utilizatorului.",
        },
      },
      required: ["name", "duration_minutes"],
    },
    execute: createServiceTool,
  },
  {
    name: "update_booking",
    description:
      "Mută o programare pe altă dată/oră. Folosește list_bookings ca să afli booking_id. IMPORTANT: confirmed=true doar după confirmare.",
    parameters: {
      type: "object",
      properties: {
        booking_id: {
          type: "string",
          description: "ID-ul programării.",
        },
        date: {
          type: "string",
          description: "Noua dată YYYY-MM-DD.",
        },
        start_time: {
          type: "string",
          description: "Noua oră HH:MM.",
        },
        barber_service_id: {
          type: "string",
          description: "Opțional: schimbă și serviciul.",
        },
        confirmed: {
          type: "boolean",
          description: "true doar după confirmarea utilizatorului.",
        },
      },
      required: ["booking_id", "date", "start_time"],
    },
    execute: updateBookingTool,
  },
  {
    name: "cancel_booking",
    description:
      "Anulează o programare. Folosește list_bookings ca să afli booking_id. IMPORTANT: confirmed=true doar după confirmare.",
    parameters: {
      type: "object",
      properties: {
        booking_id: {
          type: "string",
          description: "ID-ul programării.",
        },
        confirmed: {
          type: "boolean",
          description: "true doar după confirmarea utilizatorului.",
        },
      },
      required: ["booking_id"],
    },
    execute: cancelBookingTool,
  },
  {
    name: "close_day",
    description:
      "Închide o zi (zi liberă) pentru frizer. Folosește date=YYYY-MM-DD sau when=today|tomorrow. IMPORTANT: confirmed=true doar după confirmare.",
    parameters: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Data YYYY-MM-DD.",
        },
        when: {
          type: "string",
          enum: ["today", "tomorrow"],
          description: "Scurtătură relativă dacă nu trimiți date.",
        },
        barber_id: {
          type: "string",
          description: "Frizer (owner/manager).",
        },
        confirmed: {
          type: "boolean",
          description: "true doar după confirmarea utilizatorului.",
        },
      },
    },
    execute: closeDayTool,
  },
  {
    name: "create_vacation",
    description:
      "Setează un concediu pe un interval de zile (închide toate zilele). IMPORTANT: confirmed=true doar după confirmare.",
    parameters: {
      type: "object",
      properties: {
        date_from: {
          type: "string",
          description: "Început YYYY-MM-DD.",
        },
        date_to: {
          type: "string",
          description: "Sfârșit YYYY-MM-DD.",
        },
        barber_id: {
          type: "string",
          description: "Frizer (owner/manager).",
        },
        confirmed: {
          type: "boolean",
          description: "true doar după confirmarea utilizatorului.",
        },
      },
      required: ["date_from", "date_to"],
    },
    execute: createVacationTool,
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
