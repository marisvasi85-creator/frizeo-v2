export type PublicServicePriceFields = {
  duration: number;
  price?: number | string | null;
  show_price?: boolean | null;
};

function parsePrice(price: number | string | null | undefined): number | null {
  if (price == null || price === "") return null;
  const amount = typeof price === "number" ? price : Number(price);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100) / 100;
}

/** Lei label for a saved price, or null when the public page should hide it. */
export function visibleServicePriceLei(
  service: Pick<PublicServicePriceFields, "price" | "show_price">,
): string | null {
  if (service.show_price === false) return null;
  const amount = parsePrice(service.price);
  if (amount == null) return null;
  if (Number.isInteger(amount)) return `${amount} lei`;
  return `${amount.toFixed(2).replace(".", ",")} lei`;
}

/** Second line on a public service choice: duration, plus price when visible. */
export function publicServiceChoiceMeta(service: PublicServicePriceFields): string {
  const duration = `${service.duration} min`;
  const price = visibleServicePriceLei(service);
  return price ? `${duration} · ${price}` : duration;
}
