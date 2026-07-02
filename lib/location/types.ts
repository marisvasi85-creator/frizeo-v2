export type LocationFields = {
  address?: string | null;
  location_address_line?: string | null;
  location_city?: string | null;
  location_county?: string | null;
  location_postal_code?: string | null;
  location_maps_url?: string | null;
  location_latitude?: number | null;
  location_longitude?: number | null;
};

export type BarberLocationFields = LocationFields & {
  use_salon_location?: boolean | null;
};

export type ResolvedLocation = {
  formattedAddress: string;
  mapsUrl: string;
  wazeUrl: string;
  embedUrl: string;
  latitude: number | null;
  longitude: number | null;
};
