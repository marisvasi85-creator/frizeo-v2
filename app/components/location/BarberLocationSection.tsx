"use client";

import { useState } from "react";
import type { LocationFields } from "@/lib/location/types";
import LocationFormFields from "./LocationFormFields";

type BarberLocationSectionProps = {
  useSalonLocation: boolean;
  salonPreview: string | null;
  defaults: LocationFields;
};

export default function BarberLocationSection({
  useSalonLocation,
  salonPreview,
  defaults,
}: BarberLocationSectionProps) {
  const [useSalon, setUseSalon] = useState(useSalonLocation);

  return (
    <div className="space-y-4 border-t border-white/10 pt-5">
      <div>
        <h3 className="text-lg font-medium">Locație programări</h3>
        <p className="text-sm text-white/50 mt-1">
          Clienții văd locația pe pagina de booking și în emailurile de
          confirmare.
        </p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={useSalon}
          onChange={(e) => setUseSalon(e.target.checked)}
          className="mt-1"
        />

        <span>
          <span className="block text-sm">Folosește locația salonului</span>
          {useSalon && salonPreview && (
            <span className="block text-sm text-white/50 mt-1">
              📍 {salonPreview}
            </span>
          )}
          {useSalon && !salonPreview && (
            <span className="block text-sm text-amber-400/90 mt-1">
              Proprietarul salonului nu a setat încă o locație.
            </span>
          )}
        </span>
      </label>

      <input type="hidden" name="use_salon_location" value={useSalon ? "true" : "false"} />

      {!useSalon && <LocationFormFields defaults={defaults} idPrefix="barber" />}
    </div>
  );
}
