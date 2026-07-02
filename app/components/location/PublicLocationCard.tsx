import type { ResolvedLocation } from "@/lib/location/types";

type PublicLocationCardProps = {
  location: ResolvedLocation;
  title?: string;
};

export default function PublicLocationCard({
  location,
  title = "Locație",
}: PublicLocationCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
      <h3 className="font-semibold text-gray-900">{title}</h3>

      {location.formattedAddress && (
        <p className="text-gray-700">📍 {location.formattedAddress}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {location.mapsUrl && (
          <a
            href={location.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-800 transition"
          >
            Google Maps
          </a>
        )}

        {location.wazeUrl && (
          <a
            href={location.wazeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 rounded-lg bg-[#33ccff] text-black text-sm font-medium hover:brightness-95 transition"
          >
            Waze
          </a>
        )}
      </div>

      {location.embedUrl && (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <iframe
            title="Hartă locație"
            src={location.embedUrl}
            className="w-full h-64 border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}
