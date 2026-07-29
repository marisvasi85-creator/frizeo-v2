import { LEGAL_COMPANY, LEGAL_PRICING } from "@/lib/legal/company";

export type FaqItem = {
  question: string;
  answer: string;
};

/** FAQ citabile de AI / GEO — fapte aliniate cu planurile și copy-ul legal. */
export const FRIZEO_FAQS: FaqItem[] = [
  {
    question: "Ce este Frizeo?",
    answer:
      "Frizeo este o platformă web de programări online pentru frizerii și barbershop-uri din România. Oferă link personal de booking, calendar, notificări email/SMS (în funcție de plan), Marketing AI, director local și sync Google Calendar.",
  },
  {
    question: "Pentru cine este Frizeo?",
    answer:
      "Pentru frizeri independenți și saloane / barbershop-uri din România care vor să reducă apelurile pentru programări și să gestioneze calendarul dintr-un singur loc.",
  },
  {
    question: "Cât costă Frizeo?",
    answer: `Free: 0 lei/lună (1 frizer, 80 programări). Pro: 79 lei/lună (1 frizer, programări nelimitate, SMS reminder). Pro+: 199 lei/lună (până la 3 frizeri + invitații). Custom: la cerere. Detalii: ${LEGAL_COMPANY.website}/pricing`,
  },
  {
    question: "Frizeo are perioadă de trial?",
    answer: `${LEGAL_PRICING.trialNote} După trial poți rămâne pe Free sau trece la un plan plătit.`,
  },
  {
    question: "Frizeo trimite SMS-uri la clienți?",
    answer: LEGAL_PRICING.includedNote,
  },
  {
    question: "Trebuie să instalez o aplicație?",
    answer:
      "Nu. Frizeo rulează în browser, pe telefon sau desktop. Nu există comision pe programări și nu e nevoie de instalare pentru frizer sau client.",
  },
  {
    question: "Pot invita alți frizeri în echipă?",
    answer:
      "Pe Free și Pro: 1 frizer activ, fără invitații. Pe Pro+: până la 3 locuri (invitațiile consumă locuri împreună cu frizerii activi). Custom: personalizat.",
  },
  {
    question: "Cum se programează clienții?",
    answer:
      "Distribui link-ul tău (Instagram, WhatsApp, Google, afiș). Clientul alege serviciul, ziua și ora. Tu vezi programările în calendar; confirmările și reminder-ele pleacă automat, după setări și plan.",
  },
  {
    question: "Frizeo facturează în România?",
    answer: `Da. Operatorul este ${LEGAL_COMPANY.name} (CUI ${LEGAL_COMPANY.cui}), cu facturare fiscală în România. Contact: ${LEGAL_COMPANY.email}.`,
  },
];
