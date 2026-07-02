import type {
  BarberLocationFields,
  LocationFields,
  ResolvedLocation,
} from "./types";

function parseCoordinate(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

export function formatLocationAddress(source: LocationFields): string | null {
  const line =
    source.location_address_line?.trim() || source.address?.trim() || "";
  const city = source.location_city?.trim() || "";
  const county = source.location_county?.trim() || "";
  const postal = source.location_postal_code?.trim() || "";

  const parts = [line, city, county, postal].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

export function buildGoogleMapsUrl(
  source: LocationFields,
  formattedAddress: string | null,
): string | null {
  const custom = source.location_maps_url?.trim();
  if (custom) return custom;

  const lat = parseCoordinate(source.location_latitude);
  const lng = parseCoordinate(source.location_longitude);

  if (lat !== null && lng !== null) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  if (formattedAddress) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formattedAddress)}`;
  }

  return null;
}

export function buildWazeUrl(
  source: LocationFields,
  formattedAddress: string | null,
): string | null {
  const lat = parseCoordinate(source.location_latitude);
  const lng = parseCoordinate(source.location_longitude);

  if (lat !== null && lng !== null) {
    return `https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  }

  if (formattedAddress) {
    return `https://www.waze.com/ul?q=${encodeURIComponent(formattedAddress)}&navigate=yes`;
  }

  return null;
}

export function buildMapEmbedUrl(
  source: LocationFields,
  formattedAddress: string | null,
): string | null {
  const lat = parseCoordinate(source.location_latitude);
  const lng = parseCoordinate(source.location_longitude);

  if (lat !== null && lng !== null) {
    return `https://maps.google.com/maps?q=${lat},${lng}&hl=ro&z=15&output=embed`;
  }

  if (formattedAddress) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(formattedAddress)}&hl=ro&z=15&output=embed`;
  }

  return null;
}

export function resolveLocation(source: LocationFields): ResolvedLocation | null {
  const formattedAddress = formatLocationAddress(source);
  const mapsUrl = buildGoogleMapsUrl(source, formattedAddress);
  const wazeUrl = buildWazeUrl(source, formattedAddress);
  const embedUrl = buildMapEmbedUrl(source, formattedAddress);

  if (!formattedAddress && !mapsUrl) return null;

  return {
    formattedAddress: formattedAddress || "",
    mapsUrl: mapsUrl || "",
    wazeUrl: wazeUrl || "",
    embedUrl: embedUrl || "",
    latitude: parseCoordinate(source.location_latitude),
    longitude: parseCoordinate(source.location_longitude),
  };
}

export function resolveBarberLocation(
  salon: LocationFields,
  barber: BarberLocationFields,
): ResolvedLocation | null {
  const useSalon = barber.use_salon_location !== false;
  return resolveLocation(useSalon ? salon : barber);
}

export function locationFieldsFromFormData(formData: FormData) {
  const read = (key: string) => {
    const value = (formData.get(key) as string | null)?.trim();
    return value || null;
  };

  const latRaw = read("location_latitude");
  const lngRaw = read("location_longitude");

  return {
    location_address_line: read("location_address_line"),
    location_city: read("location_city"),
    location_county: read("location_county"),
    location_postal_code: read("location_postal_code"),
    location_maps_url: read("location_maps_url"),
    location_latitude: latRaw ? parseCoordinate(latRaw) : null,
    location_longitude: lngRaw ? parseCoordinate(lngRaw) : null,
    address: formatLocationAddress({
      location_address_line: read("location_address_line"),
      location_city: read("location_city"),
      location_county: read("location_county"),
      location_postal_code: read("location_postal_code"),
    }),
  };
}
