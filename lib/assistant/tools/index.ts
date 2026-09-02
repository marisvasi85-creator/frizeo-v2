import type { AssistantToolDefinition } from "../types";
import { bookingLinkTool } from "./bookingLink";
import { cancelBookingTool } from "./cancelBooking";
import { clientHistoryTool } from "./clientHistory";
import { createBookingTool } from "./createBooking";
import { createServiceTool } from "./createService";
import { findSlotsTool } from "./findSlots";
import { inviteBarberTool } from "./inviteBarber";
import { listBarbersTool } from "./listBarbers";
import { listBookingsTool } from "./listBookings";
import { listServicesTool } from "./listServices";
import {
  getNextBookingTool,
  getTodayBriefingTool,
} from "./nextBooking";
import { popularServicesTool } from "./popularServices";
import { productHelpTool } from "./productHelp";
import { rescheduleBookingTool } from "./rescheduleBooking";
import {
  closeDayTool,
  createVacationTool,
  deleteVacationTool,
  listVacationsTool,
  openDayTool,
} from "./scheduleTools";
import { subscriptionStatusTool } from "./subscriptionStatus";
import {
  deactivateServiceTool,
  updateServiceTool,
} from "./updateService";
import {
  listWeeklyScheduleTool,
  updateWeeklyScheduleTool,
} from "./weeklySchedule";

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
      "Listează programările pe o perioadă (azi, mâine, săptămâna, interval). Caută după telefon sau nume. Implicit fără anulate; include_cancelled=true le include. Limită max 100.",
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
        client_phone: {
          type: "string",
          description:
            "Caută după telefon (07… sau +40…). Fără date = ultimele 90 zile + 30 înainte.",
        },
        client_name: {
          type: "string",
          description: "Caută după nume client (parțial).",
        },
        include_cancelled: {
          type: "boolean",
          description: "Include și programările anulate. Implicit false.",
        },
        limit: {
          type: "number",
          description: "Câte programări (implicit 50, max 100).",
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
      "Reprogramare ghidată: găsește programarea (booking_id, client_name sau telefon), propune ore libere, apoi mută după confirmare. Folosește ÎNTOTDEAUNA acest tool (nu update_booking) când utilizatorul zice „mută-l”.",
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
      "Alias intern pentru reschedule_booking. NU-l apela din chat — folosește reschedule_booking.",
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
        client_phone: {
          type: "string",
          description: "Telefon opțional pentru dezambiguizare.",
        },
        when: {
          type: "string",
          enum: ["today", "tomorrow"],
        },
        confirmed: {
          type: "boolean",
          description:
            "Nu seta true din chat — confirmarea vine din butoanele UI.",
        },
      },
    },
    execute: rescheduleBookingTool,
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
  {
    name: "booking_link",
    description:
      "Returnează URL-ul public de programare (salon sau frizer), gata de copiat. Folosește la „care e link-ul”, Instagram bio, WhatsApp.",
    parameters: {
      type: "object",
      properties: {
        barber_id: BARBER_ID_PROP,
        barber_name: BARBER_NAME_PROP,
        for_me: {
          type: "boolean",
          description: "true = link-ul frizerului curent, nu al salonului.",
        },
      },
    },
    execute: bookingLinkTool,
  },
  {
    name: "list_weekly_schedule",
    description:
      "Citește programul săptămânal Luni–Duminică (1=Luni … 7=Duminică) și modul weekly/selective.",
    parameters: {
      type: "object",
      properties: {
        barber_id: BARBER_ID_PROP,
        barber_name: BARBER_NAME_PROP,
      },
    },
    execute: listWeeklyScheduleTool,
  },
  {
    name: "update_weekly_schedule",
    description:
      "Modifică O ZI din programul săptămânal (nu o dată anume). day_of_week 1=Luni … 7=Duminică. Pentru o zi calendaristică folosește close_day/open_day. IMPORTANT: confirmed=true doar după confirmare.",
    parameters: {
      type: "object",
      properties: {
        day_of_week: {
          type: "number",
          description: "1=Luni … 7=Duminică. Acceptă și day=„luni”.",
        },
        day: {
          type: "string",
          description: "Numele zilei: luni, marți, … duminică.",
        },
        is_working: {
          type: "boolean",
          description: "false = ziua e închisă în orarul săptămânal.",
        },
        work_start: { type: "string", description: "HH:MM" },
        work_end: { type: "string", description: "HH:MM" },
        break_enabled: { type: "boolean" },
        break_start: { type: "string", description: "HH:MM" },
        break_end: { type: "string", description: "HH:MM" },
        barber_id: BARBER_ID_PROP,
        barber_name: BARBER_NAME_PROP,
        confirmed: {
          type: "boolean",
          description: "true doar după confirmarea utilizatorului.",
        },
      },
    },
    execute: updateWeeklyScheduleTool,
  },
  {
    name: "update_service",
    description:
      "Actualizează un serviciu (nume, durată, preț, activ). Prețul poate fi golit cu clear_price. IMPORTANT: confirmed=true doar după confirmare.",
    parameters: {
      type: "object",
      properties: {
        service_id: { type: "string" },
        service_name: { type: "string" },
        new_name: { type: "string" },
        duration_minutes: { type: "number" },
        price_ron: { type: "number" },
        clear_price: {
          type: "boolean",
          description: "true = scoate prețul.",
        },
        active: { type: "boolean" },
        barber_id: BARBER_ID_PROP,
        barber_name: BARBER_NAME_PROP,
        confirmed: {
          type: "boolean",
          description: "true doar după confirmarea utilizatorului.",
        },
      },
    },
    execute: updateServiceTool,
  },
  {
    name: "deactivate_service",
    description:
      "Dezactivează (sau reactivează cu active=true) un serviciu. Dispare de pe pagina publică. IMPORTANT: confirmed=true doar după confirmare.",
    parameters: {
      type: "object",
      properties: {
        service_id: { type: "string" },
        service_name: { type: "string" },
        active: {
          type: "boolean",
          description: "true = reactivează. Implicit dezactivează.",
        },
        barber_id: BARBER_ID_PROP,
        barber_name: BARBER_NAME_PROP,
        confirmed: {
          type: "boolean",
          description: "true doar după confirmarea utilizatorului.",
        },
      },
    },
    execute: deactivateServiceTool,
  },
  {
    name: "invite_barber",
    description:
      "Invită un frizer pe email (doar owner/manager). Arată draft + limite de plan, apoi trimite după Confirmă. Fără nume+email: spune dacă planul permite invitații.",
    parameters: {
      type: "object",
      properties: {
        full_name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        confirmed: {
          type: "boolean",
          description: "true doar după confirmarea utilizatorului.",
        },
      },
    },
    execute: inviteBarberTool,
  },
  {
    name: "client_history",
    description:
      "Istoricul ultimelor programări ale unui client (telefon sau nume). Include anulate. Fără sume / încasări.",
    parameters: {
      type: "object",
      properties: {
        client_phone: { type: "string" },
        client_name: { type: "string" },
        limit: {
          type: "number",
          description: "Câte (implicit 10, max 30).",
        },
        barber_id: BARBER_ID_PROP,
        barber_name: BARBER_NAME_PROP,
      },
    },
    execute: clientHistoryTool,
  },
  {
    name: "product_help",
    description:
      "Knowledge base despre funcționalitățile admin Frizeo: SMS, Google Calendar, programări, servicii, program, frizeri, link public, acces clienți, rapoarte, Marketing AI, abonament, Assistant, salon, profil. Folosește LA ORICE întrebare „cum funcționează / unde găsesc / ce face pagina X”.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Întrebarea utilizatorului sau topic (ex: SMS, Google Calendar).",
        },
      },
      required: ["query"],
    },
    execute: productHelpTool,
  },
];

export function getAssistantTool(name: string) {
  return ASSISTANT_TOOLS.find((tool) => tool.name === name) ?? null;
}

export function getOpenAIToolDefinitions() {
  return ASSISTANT_TOOLS.filter((tool) => tool.name !== "update_booking").map(
    (tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }),
  );
}
