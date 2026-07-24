"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { DirectorySalon } from "@/lib/seo/directorySalons";
import {
  DIRECTORY_FILTERS,
  salonMatchesFilters,
} from "@/lib/seo/directoryFilters";
import DirectoryMap from "./DirectoryMap";

export default function DirectorySalonBrowser({
  salons,
  cityLabel,
  intro,
  showMap = true,
}: {
  salons: DirectorySalon[];
  cityLabel?: string;
  intro?: string | null;
  showMap?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [showMapPanel, setShowMapPanel] = useState(false);

  const availableFilters = useMemo(() => {
    const present = new Set(salons.flatMap((s) => s.filter_tags));
    return DIRECTORY_FILTERS.filter((f) => present.has(f.id));
  }, [salons]);

  const filtered = useMemo(
    () => salons.filter((s) => salonMatchesFilters(s.filter_tags, selected)),
    [salons, selected]
  );

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <div className="space-y-8">
      {intro && (
        <p className="text-gray-600 max-w-2xl leading-relaxed">{intro}</p>
      )}

      {availableFilters.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Filtrează după serviciu</p>
          <div className="flex flex-wrap gap-2">
            {availableFilters.map((f) => {
              const active = selected.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => toggle(f.id)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition ${
                    active
                      ? "bg-black text-white border-black"
                      : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => setSelected([])}
                className="px-3 py-1.5 text-sm text-gray-500 underline"
              >
                Resetează
              </button>
            )}
          </div>
        </div>
      )}

      {showMap && (
        <div>
          <button
            type="button"
            onClick={() => setShowMapPanel((v) => !v)}
            className="text-sm font-medium underline"
          >
            {showMapPanel ? "Ascunde harta" : "Arată pe hartă"}
          </button>
          {showMapPanel && (
            <div className="mt-4">
              <DirectoryMap salons={filtered} />
            </div>
          )}
        </div>
      )}

      <p className="text-sm text-gray-500">
        {filtered.length}{" "}
        {filtered.length === 1 ? "salon" : "saloane"}
        {cityLabel ? ` în ${cityLabel}` : ""}
        {selected.length > 0 ? " (filtrate)" : ""}
      </p>

      <ul className="space-y-4">
        {filtered.map((salon) => (
          <li key={salon.id}>
            <Link
              href={`/booking/salon/${salon.slug}`}
              className="flex gap-4 rounded-2xl border border-gray-200 p-4 hover:bg-gray-50 transition"
            >
              {salon.logo_url ? (
                <Image
                  src={salon.logo_url}
                  alt={`Logo ${salon.name}`}
                  width={72}
                  height={72}
                  className="w-[72px] h-[72px] rounded-xl object-cover shrink-0"
                />
              ) : (
                <div className="w-[72px] h-[72px] rounded-xl bg-gray-100 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold">{salon.name}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {[salon.location_address_line, salon.location_city]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {salon.active_barbers}{" "}
                  {salon.active_barbers === 1 ? "frizer" : "frizeri"} ·
                  Programare online
                </p>
                {salon.filter_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {salon.filter_tags.map((tag) => {
                      const label =
                        DIRECTORY_FILTERS.find((f) => f.id === tag)?.label ||
                        tag;
                      return (
                        <span
                          key={tag}
                          className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
                        >
                          {label}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              <span className="self-center text-sm font-medium whitespace-nowrap">
                Vezi →
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {filtered.length === 0 && (
        <p className="text-gray-500">Niciun salon nu corespunde filtrelor.</p>
      )}
    </div>
  );
}
