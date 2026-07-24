"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import type { DirectorySalon } from "@/lib/seo/directorySalons";

type MapSalon = Pick<
  DirectorySalon,
  | "id"
  | "name"
  | "slug"
  | "location_city"
  | "location_latitude"
  | "location_longitude"
  | "location_address_line"
>;

export default function DirectoryMap({ salons }: { salons: MapSalon[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const withCoords = useMemo(
    () =>
      salons.filter(
        (s) =>
          typeof s.location_latitude === "number" &&
          typeof s.location_longitude === "number"
      ),
    [salons]
  );

  useEffect(() => {
    if (!mapRef.current || withCoords.length === 0) return;

    let cancelled = false;
    let map: import("leaflet").Map | null = null;

    async function init() {
      const L = await import("leaflet");

      if (!document.querySelector('link[data-leaflet-css]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        link.setAttribute("data-leaflet-css", "1");
        document.head.appendChild(link);
      }

      if (cancelled || !mapRef.current) return;

      // Fix default marker icons in bundlers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const lats = withCoords.map((s) => s.location_latitude as number);
      const lngs = withCoords.map((s) => s.location_longitude as number);
      const center: [number, number] = [
        lats.reduce((a, b) => a + b, 0) / lats.length,
        lngs.reduce((a, b) => a + b, 0) / lngs.length,
      ];

      map = L.map(mapRef.current).setView(center, withCoords.length === 1 ? 14 : 11);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const bounds: import("leaflet").LatLngExpression[] = [];
      for (const salon of withCoords) {
        const latlng: [number, number] = [
          salon.location_latitude as number,
          salon.location_longitude as number,
        ];
        bounds.push(latlng);
        L.marker(latlng)
          .addTo(map)
          .bindPopup(
            `<strong>${salon.name}</strong><br/><a href="/booking/salon/${salon.slug}">Programare</a>`
          );
      }

      if (bounds.length > 1) {
        map.fitBounds(bounds as import("leaflet").LatLngBoundsExpression, {
          padding: [40, 40],
        });
      }
    }

    init().catch((err) => console.error("DirectoryMap:", err));

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [withCoords]);

  if (withCoords.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Niciun salon din listă nu are coordonate pe hartă încă. Completează
        lat/lng în locația salonului.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div
        ref={mapRef}
        className="w-full h-[380px] rounded-2xl border border-gray-200 overflow-hidden z-0"
      />
      <ul className="text-sm text-gray-600 space-y-1">
        {withCoords.map((s) => (
          <li key={s.id}>
            <Link href={`/booking/salon/${s.slug}`} className="underline">
              {s.name}
            </Link>
            {s.location_address_line ? ` — ${s.location_address_line}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
