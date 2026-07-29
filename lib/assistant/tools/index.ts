import type { AssistantToolDefinition } from "../types";
import { cancelBookingTool } from "./cancelBooking";
import { createBookingTool } from "./createBooking";
import { createServiceTool } from "./createService";
import { findSlotsTool } from "./findSlots";
import { listBarbersTool } from "./listBarbers";
import { listBookingsTool } from "./listBookings";
import { listServicesTool } from "./listServices";
import {
  getNextBookingTool,
  getTodayBriefingTool,
} from "./nextBooking";
import { popularServicesTool } from "./popularServices";
import { rescheduleBookingTool } from "./rescheduleBooking";
import {
  closeDayTool,
  createVacationTool,
  deleteVacationTool,
  listVacationsTool,
  openDayTool,
} from "./scheduleTools";
import { subscriptionStatusTool } from "./subscriptionStatus";
import { updateBookingTool } from "./updateBooking";

const BARBER_ID_PROP = {
  type: "string",
  description:
    "ID frizer (owner/manager). Dacă salonul are mai mulți frizeri și e ambiguu, folosește list_barbers.",
};

const BARBER_NAME_PROP = {
  type: "string",
  description:
    "Nume frizer dacă nu ai barber_id (ex: „Andrei”). Folosește list_barbers când e nevoie.",
};

export const ASSISTANT_TOOLS: AssistantToolDefinition[] = [
  {
    name: "list_barbers",
    description:
      "Listează frizerii salonului (activi + inactivi). Folosește când sunt mai mulți și trebuie ales unul înainte de o acțiune.",
    parameters: {
      type: "object",
      properties: {},
    },
    execute: listBarbersTool,
  },
  {
    name: "today_briefing",
    description:
      "Briefing rapid pentru ziua de azi: câte programări, câte au trecut, câte rămân, cine e următorul client.",
    parameters: {
      type: "object",
      properties: {
        barber_id: BARBER_ID_PROP,
        barber_name: BARBER_NAME_PROP,
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
        barber_id: BARBER_ID_PROP,
        barber_name: BARBER_NAME_PROP,
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
        barber_id: BARBER_ID_PROP,
        barber_name: {
          type: "string",
          description:
            "Filtrează pe numele frizerului (opțional; fără filtru = tot salonul).",
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
        barber_id: BARBER_ID_PROP,
        barber_name: {
          type: "string",
          description:
            "Filtrează pe numele frizerului (opțional; fără filtru = tot salonul).",
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
        barber_id: BARBER_ID_PROP,
        barber_name: {
          type: "string",
          description:
            "Filtrează pe numele frizerului (opțional; fără filtru = tot salonul).",
        },
      },
    },
    execute: popularServicesTool,
  },
  {
    name: "subscription_status",
    description:
      "Status abonament Frizeo: plan, trial, frizeri activi, invitații, rol owner, unde se schimbă rolul (Frizeri → Opțiune: apari și ca frizer), și dacă după trial poate alege Pro fără modificări. Folosește la întrebări despre plan, trial, invitații, rol admin/frizer.",
    parameters: {
      type: "object",
      properties: {},
    },
    execute: subscriptionStatusTool,
  },
  {
    name: "find_slots",
    description:
      "Găsește ore libere pentru un serviciu pe o dată. Folosește înainte de create_booking sau update_booking când utilizatorul întreabă „ce ore am libere”.",
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
          description: "Scurtătură dacă nu trimiți date.",
        },
        service_id: {
          type: "string",
          description: "ID serviciu (din list_services).",
        },
        service_name: {
          type: "string",
          description: "Nume serviciu dacă nu ai service_id (ex: Tuns).",
        },
        barber_id: BARBER_ID_PROP,
        barber_name: BARBER_NAME_PROP,
        limit: {
          type: "number",
          description: "Câte ore să returnezi (implicit 12, max 40).",
        },
        exclude_booking_id: {
          type: "string",
          description:
            "La reprogramare: exclude această programare din ocupare (ca slotul ei să apară liber).",
        },
      },
    },
    execute: findSlotsTool,
  },
  {
    name: "create_booking",
    description:
      "Creează o programare nouă (admin). IMPORTANT: prima dată fără confirmed; după confirmare, cu confirmed=true. Ideal: find_slots sau list_services înainte.",
    parameters: {
      type: "object",
      properties: {
        client_name: {
          type: "string",
          description: "Numele clientului.",
        },
        client_phone: {
          type: "string",
          description: "Telefon RO: 07XXXXXXXX sau +40XXXXXXXXX.",
        },
        client_email: {
          type: "string",
          description: "Email opțional (pentru confirmare).",
        },
        client_notes: {
          type: "string",
          description: "Notă opțională.",
        },
        date: {
          type: "string",
          description: "Data YYYY-MM-DD.",
        },
        when: {
          type: "string",
          enum: ["today", "tomorrow"],
          description: "Scurtătură dacă nu trimiți date.",
        },
        start_time: {
          type: "string",
          description: "Ora HH:MM.",
        },
        service_id: {
          type: "string",
          description: "ID serviciu.",
        },
        service_name: {
          type: "string",
          description: "Nume serviciu dacă nu ai service_id.",
        },
        barber_id: BARBER_ID_PROP,
        barber_name: BARBER_NAME_PROP,
        confirmed: {
          type: "boolean",
          description: "true doar după confirmarea explicită a utilizatorului.",
        },
      },
      required: ["client_name", "client_phone", "start_time"],
    },
    execute: createBookingTool,
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
        barber_id: BARBER_ID_PROP,
        barber_name: BARBER_NAME_PROP,
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
    name: "reschedule_booking",
    description:
      "Reprogramare ghidată: găsește programarea (booking_id sau client_name), propune ore libere pe o dată nouă, apoi mută după confirmare. Preferă acest tool față de update_booking când utilizatorul zice „mută-l pe X pe mâine”.",
    parameters: {
      type: "object",
      properties: {
        booking_id: {
          type: "string",
          description: "ID programare (din list_bookings). Preferat dacă îl ai.",
        },
        client_name: {
          type: "string",
          description: "Nume client dacă nu ai booking_id.",
        },
        client_phone: {
          type: "string",
          description: "Telefon opțional pentru dezambiguizare.",
        },
        current_date: {
          type: "string",
          description: "Data actuală a programării (YYYY-MM-DD) pentru dezambiguizare.",
        },
        date: {
          type: "string",
          description: "Noua dată YYYY-MM-DD.",
        },
        when: {
          type: "string",
          enum: ["today", "tomorrow"],
          description: "Scurtătură dacă nu trimiți date.",
        },
        start_time: {
          type: "string",
          description:
            "Noua oră HH:MM. Dacă lipsește, tool-ul returnează ore libere.",
        },
        barber_id: BARBER_ID_PROP,
        barber_name: BARBER_NAME_PROP,
        limit: {
          type: "number",
          description: "Câte ore libere să propună (implicit 12).",
        },
        confirmed: {
          type: "boolean",
          description:
            "true doar după confirmare, și doar când ai deja start_time.",
        },
      },
    },
    execute: rescheduleBookingTool,
  },
  {
    name: "update_booking",
    description:
      "Mută o programare pe altă dată/oră când ai booking_id (sau client_name) + dată + oră. Pentru flux ghidat, preferă reschedule_booking. Confirmarea finală se face din butoanele UI.",
    parameters: {
      type: "object",
      properties: {
        booking_id: {
          type: "string",
          description: "ID-ul programării.",
        },
        client_name: {
          type: "string",
          description: "Nume client dacă nu ai booking_id.",
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
          description:
            "Nu seta true din chat — confirmarea vine din butoanele UI.",
        },
      },
      required: ["date", "start_time"],
    },
    execute: updateBookingTool,
  },
  {
    name: "cancel_booking",
    description:
      "Anulează o programare după booking_id sau client_name. IMPORTANT: apelează fără confirmed; confirmarea se face din butoanele UI.",
    parameters: {
      type: "object",
      properties: {
        booking_id: {
          type: "string",
          description: "ID-ul programării (preferat).",
        },
        client_name: {
          type: "string",
          description: "Nume client dacă nu ai booking_id.",
        },
        client_phone: {
          type: "string",
          description: "Telefon opțional pentru dezambiguizare.",
        },
        current_date: {
          type: "string",
          description: "Data programării (YYYY-MM-DD) pentru dezambiguizare.",
        },
        barber_id: BARBER_ID_PROP,
        barber_name: BARBER_NAME_PROP,
        confirmed: {
          type: "boolean",
          description:
            "Nu seta true din chat — confirmarea vine din butoanele UI.",
        },
      },
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
        barber_id: BARBER_ID_PROP,
        barber_name: BARBER_NAME_PROP,
        confirmed: {
          type: "boolean",
          description: "true doar după confirmarea utilizatorului.",
        },
      },
    },
    execute: closeDayTool,
  },
  {
    name: "open_day",
    description:
      "Redeschide o zi închisă (șterge override-ul de zi liberă). Folosește date=YYYY-MM-DD sau when=today|tomorrow. IMPORTANT: confirmed=true doar după confirmare.",
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
        barber_id: BARBER_ID_PROP,
        barber_name: BARBER_NAME_PROP,
        confirmed: {
          type: "boolean",
          description: "true doar după confirmarea utilizatorului.",
        },
      },
    },
    execute: openDayTool,
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
        barber_id: BARBER_ID_PROP,
        barber_name: BARBER_NAME_PROP,
        confirmed: {
          type: "boolean",
          description: "true doar după confirmarea utilizatorului.",
        },
      },
      required: ["date_from", "date_to"],
    },
    execute: createVacationTool,
  },
  {
    name: "list_vacations",
    description:
      "Listează concediile / zilele libere viitoare pentru un frizer (cu vacation_period_id pentru ștergere).",
    parameters: {
      type: "object",
      properties: {
        barber_id: BARBER_ID_PROP,
        barber_name: BARBER_NAME_PROP,
      },
    },
    execute: listVacationsTool,
  },
  {
    name: "delete_vacation",
    description:
      "Șterge un concediu după vacation_period_id (din list_vacations) sau după date_from + date_to. IMPORTANT: confirmed=true doar după confirmare.",
    parameters: {
      type: "object",
      properties: {
        vacation_period_id: {
          type: "string",
          description: "ID perioadă din list_vacations.",
        },
        vacation_id: {
          type: "string",
          description: "Alias pentru vacation_period_id.",
        },
        date_from: {
          type: "string",
          description: "Început YYYY-MM-DD dacă nu ai period id.",
        },
        date_to: {
          type: "string",
          description: "Sfârșit YYYY-MM-DD dacă nu ai period id.",
        },
        barber_id: BARBER_ID_PROP,
        barber_name: BARBER_NAME_PROP,
        confirmed: {
          type: "boolean",
          description: "true doar după confirmarea utilizatorului.",
        },
      },
    },
    execute: deleteVacationTool,
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
