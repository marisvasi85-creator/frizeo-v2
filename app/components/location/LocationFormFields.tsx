import type { LocationFields } from "@/lib/location/types";

type LocationFormFieldsProps = {
  defaults: LocationFields;
  idPrefix?: string;
};

export default function LocationFormFields({
  defaults,
  idPrefix = "",
}: LocationFormFieldsProps) {
  const addressLine =
    defaults.location_address_line ?? defaults.address ?? "";

  const fieldId = (name: string) => (idPrefix ? `${idPrefix}-${name}` : name);

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor={fieldId("location_address_line")}
          className="block text-sm text-white/60 mb-2"
        >
          Stradă și număr
        </label>

        <input
          id={fieldId("location_address_line")}
          type="text"
          name="location_address_line"
          defaultValue={addressLine}
          placeholder="Str. Exemplu nr. 10"
          className="w-full bg-[#0F0F10] border border-white/10 rounded-lg px-4 py-3"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor={fieldId("location_city")}
            className="block text-sm text-white/60 mb-2"
          >
            Localitate
          </label>

          <input
            id={fieldId("location_city")}
            type="text"
            name="location_city"
            defaultValue={defaults.location_city || ""}
            placeholder="Arad"
            className="w-full bg-[#0F0F10] border border-white/10 rounded-lg px-4 py-3"
          />
        </div>

        <div>
          <label
            htmlFor={fieldId("location_county")}
            className="block text-sm text-white/60 mb-2"
          >
            Județ
          </label>

          <input
            id={fieldId("location_county")}
            type="text"
            name="location_county"
            defaultValue={defaults.location_county || ""}
            placeholder="Arad"
            className="w-full bg-[#0F0F10] border border-white/10 rounded-lg px-4 py-3"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor={fieldId("location_postal_code")}
          className="block text-sm text-white/60 mb-2"
        >
          Cod poștal (opțional)
        </label>

        <input
          id={fieldId("location_postal_code")}
          type="text"
          name="location_postal_code"
          defaultValue={defaults.location_postal_code || ""}
          className="w-full bg-[#0F0F10] border border-white/10 rounded-lg px-4 py-3"
        />
      </div>

      <div>
        <label
          htmlFor={fieldId("location_maps_url")}
          className="block text-sm text-white/60 mb-2"
        >
          Link Google Maps (opțional)
        </label>

        <input
          id={fieldId("location_maps_url")}
          type="url"
          name="location_maps_url"
          defaultValue={defaults.location_maps_url || ""}
          placeholder="https://maps.google.com/..."
          className="w-full bg-[#0F0F10] border border-white/10 rounded-lg px-4 py-3"
        />

        <p className="text-xs text-white/40 mt-2">
          Dacă lași gol, generăm link automat din adresă sau coordonate.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor={fieldId("location_latitude")}
            className="block text-sm text-white/60 mb-2"
          >
            Latitudine (opțional)
          </label>

          <input
            id={fieldId("location_latitude")}
            type="text"
            name="location_latitude"
            defaultValue={
              defaults.location_latitude != null
                ? String(defaults.location_latitude)
                : ""
            }
            placeholder="46.186"
            className="w-full bg-[#0F0F10] border border-white/10 rounded-lg px-4 py-3"
          />
        </div>

        <div>
          <label
            htmlFor={fieldId("location_longitude")}
            className="block text-sm text-white/60 mb-2"
          >
            Longitudine (opțional)
          </label>

          <input
            id={fieldId("location_longitude")}
            type="text"
            name="location_longitude"
            defaultValue={
              defaults.location_longitude != null
                ? String(defaults.location_longitude)
                : ""
            }
            placeholder="21.312"
            className="w-full bg-[#0F0F10] border border-white/10 rounded-lg px-4 py-3"
          />
        </div>
      </div>
    </div>
  );
}
