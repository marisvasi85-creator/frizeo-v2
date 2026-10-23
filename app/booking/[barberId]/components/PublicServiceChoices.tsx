"use client";

import {
  publicServiceChoiceMeta,
  type PublicServicePriceFields,
} from "@/lib/services/publicServicePrice";

export type PublicBookingService = PublicServicePriceFields & {
  id: string;
  display_name: string;
};

export function PublicServiceChoices({
  services,
  serviceId,
  onSelect,
}: {
  services: PublicBookingService[];
  serviceId: string | null;
  onSelect: (serviceId: string) => void;
}) {
  if (services.length === 0) return null;

  return (
    <div
      className={`space-y-3 rounded-2xl p-1 ${
        !serviceId ? "ring-2 ring-frz-accent/35 ring-offset-2 ring-offset-frz-bg" : ""
      }`}
    >
      <p
        className={`text-base font-bold text-frz-ink ${
          !serviceId ? "animate-frz-attention" : ""
        }`}
      >
        1. Alege serviciul
      </p>
      {!serviceId && (
        <p className="text-sm font-medium text-frz-accent animate-frz-attention">
          Începe de aici — selectează serviciul dorit
        </p>
      )}
      {services.map((service) => (
        <button
          key={service.id}
          type="button"
          onClick={() => onSelect(service.id)}
          className={`w-full rounded-xl border border-frz-line p-4 transition ${
            serviceId === service.id
              ? "border-frz-ink bg-frz-ink text-frz-ink-contrast"
              : "bg-frz-card text-frz-ink shadow-sm hover:bg-frz-fog"
          }`}
        >
          <span className="flex w-full flex-col items-start gap-1 text-left">
            <span
              className={
                !serviceId || serviceId === service.id ? "font-semibold" : undefined
              }
            >
              {service.display_name}
            </span>
            <span
              className={`text-sm ${
                serviceId === service.id ? "opacity-80" : "text-frz-muted"
              }`}
            >
              {publicServiceChoiceMeta(service)}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

export function PublicBookingSelectionSummary({
  service,
}: {
  service: PublicBookingService;
}) {
  return (
    <p className="rounded-xl border border-frz-line bg-frz-fog px-4 py-3 text-sm text-frz-ink">
      <span className="font-medium">{service.display_name}</span>
      <span className="text-frz-muted"> · {publicServiceChoiceMeta(service)}</span>
    </p>
  );
}
