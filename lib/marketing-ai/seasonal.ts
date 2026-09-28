import {
  addCalendarDays,
  dateStringFromDate,
  isDateInRange,
  orthodoxEasterDateString,
} from "./orthodoxEaster";
import type { MarketingContentType } from "./types";

export type MarketingActionDef = {
  type: MarketingContentType;
  label: string;
  icon: string;
  needsService?: boolean;
  seasonal?: boolean;
};

const CORE_ACTIONS: MarketingActionDef[] = [
  { type: "instagram_post", label: "Generează postare Instagram", icon: "📸" },
  { type: "reel", label: "Generează Reel", icon: "🎥" },
  { type: "story", label: "Generează Story", icon: "📖" },
  {
    type: "service_promo",
    label: "Promovează serviciul",
    icon: "💈",
    needsService: true,
  },
  {
    type: "birthday_offer",
    label: "Generează ofertă de aniversare",
    icon: "🎂",
  },
  {
    type: "work_promo",
    label: "Promovează o lucrare",
    icon: "✨",
  },
  {
    type: "open_slots",
    label: "Umple locurile libere",
    icon: "📅",
  },
];

const SEASONAL_ACTIONS: MarketingActionDef[] = [
  {
    type: "christmas_promo",
    label: "Promoție de Crăciun",
    icon: "🎄",
    seasonal: true,
  },
  {
    type: "easter_promo",
    label: "Promoție de Paște",
    icon: "🐣",
    seasonal: true,
  },
  {
    type: "black_friday",
    label: "Black Friday",
    icon: "🖤",
    seasonal: true,
  },
  {
    type: "back_to_school",
    label: "Back to school",
    icon: "🎒",
    seasonal: true,
  },
];

const CONTENT_LABELS: Record<string, string> = {
  instagram_post: "Postare",
  reel: "Reel",
  story: "Story",
  service_promo: "Promovare serviciu",
  birthday_offer: "Ofertă de aniversare",
  christmas_promo: "Promoție de Crăciun",
  easter_promo: "Promoție de Paște",
  black_friday: "Black Friday",
  back_to_school: "Back to school",
  work_promo: "Promovează o lucrare",
  open_slots: "Locuri libere",
};

function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  n: number,
): string {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const delta = (weekday - first.getUTCDay() + 7) % 7;
  const day = 1 + delta + (n - 1) * 7;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function seasonalWindow(
  type: MarketingContentType,
  today: string,
): { start: string; end: string } | null {
  const year = Number(today.slice(0, 4));
  if (!Number.isFinite(year)) return null;

  switch (type) {
    case "christmas_promo": {
      const start = `${year}-11-15`;
      const end = `${year + 1}-01-06`;
      if (today <= `${year}-01-06`) {
        return { start: `${year - 1}-11-15`, end: `${year}-01-06` };
      }
      return { start, end };
    }
    case "easter_promo": {
      const easter = orthodoxEasterDateString(year);
      // Also cover early January viewing of next year's window? Not needed.
      // If today is after this year's window, look at next year so late December still works? No.
      const start = addCalendarDays(easter, -21);
      const end = addCalendarDays(easter, 1);
      if (today > end) {
        const next = orthodoxEasterDateString(year + 1);
        return { start: addCalendarDays(next, -21), end: addCalendarDays(next, 1) };
      }
      return { start, end };
    }
    case "black_friday": {
      const friday = nthWeekdayOfMonth(year, 11, 5, 4);
      return { start: addCalendarDays(friday, -14), end: friday };
    }
    case "back_to_school":
      return { start: `${year}-08-10`, end: `${year}-09-20` };
    default:
      return null;
  }
}

export function isSeasonalTypeActive(
  type: MarketingContentType,
  now: Date = new Date(),
): boolean {
  const today = dateStringFromDate(now);
  const window = seasonalWindow(type, today);
  if (!window) return true;
  return isDateInRange(today, window.start, window.end);
}

export function getAvailableMarketingActions(
  now = new Date(),
): MarketingActionDef[] {
  const seasonal = SEASONAL_ACTIONS.filter((action) =>
    isSeasonalTypeActive(action.type, now),
  );
  return [...CORE_ACTIONS, ...seasonal];
}

export function getSeasonalActions(now = new Date()): MarketingActionDef[] {
  return SEASONAL_ACTIONS.filter((action) => isSeasonalTypeActive(action.type, now));
}

export function getMarketingContentTypeLabel(type: string): string {
  return CONTENT_LABELS[type] || type;
}
