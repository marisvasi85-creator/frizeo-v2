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

/** Month is 1-12 */
export function isSeasonalTypeActive(
  type: MarketingContentType,
  month = new Date().getMonth() + 1,
): boolean {
  switch (type) {
    case "christmas_promo":
      return month === 11 || month === 12 || month === 1;
    case "easter_promo":
      return month === 3 || month === 4;
    case "black_friday":
      return month === 11;
    case "back_to_school":
      return month === 8 || month === 9;
    default:
      return true;
  }
}

export function getAvailableMarketingActions(
  now = new Date(),
): MarketingActionDef[] {
  const month = now.getMonth() + 1;
  const seasonal = SEASONAL_ACTIONS.filter((action) =>
    isSeasonalTypeActive(action.type, month),
  );
  return [...CORE_ACTIONS, ...seasonal];
}

export function getMarketingContentTypeLabel(type: string): string {
  const all = [...CORE_ACTIONS, ...SEASONAL_ACTIONS];
  return all.find((action) => action.type === type)?.label || type;
}
