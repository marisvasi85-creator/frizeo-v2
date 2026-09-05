"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminCard from "./AdminCard";
import AdminButton from "./AdminButton";
import { AdminInput } from "./AdminInput";
import FormSaveButton from "./FormSaveButton";
import { markSetupChecklistStep } from "@/lib/setup-checklist/storage";
import {
  publicBookingUrl,
  publicSalonUrl,
} from "@/lib/booking/publicBookingPath";
import {
  checkBookingLinkSlug,
  updateBookingLink,
  type BookingLinkFormState,
  type BookingSlugKind,
} from "../lib/bookingLinkActions";
import { initialSaveFormState } from "./saveFormState";

type Availability = {
  status: "idle" | "checking" | "ok" | "error";
  message?: string;
};

function displayHost(appUrl: string) {
  try {
    return new URL(appUrl).host;
  } catch {
    return appUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

export default function BookingLinkCard({
  initialUrl,
  appUrl,
  tenantSlug,
  barberSlug,
  canEditTenantSlug = false,
  canEditBarberSlug = false,
  customizationEnabled = false,
  barberId,
  title = "Linkul tău de programări",
}: {
  initialUrl: string;
  appUrl?: string;
  tenantSlug?: string;
  barberSlug?: string | null;
  canEditTenantSlug?: boolean;
  canEditBarberSlug?: boolean;
  customizationEnabled?: boolean;
  barberId?: string;
  title?: string;
}) {
  const showEditor =
    customizationEnabled && (canEditTenantSlug || canEditBarberSlug) && !!tenantSlug;

  const [url, setUrl] = useState(initialUrl);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(initialUrl);
  }, [initialUrl]);

  function markShared() {
    if (barberId) markSetupChecklistStep(barberId, "share_link");
  }

  async function copyLink() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    markShared();
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <AdminCard id="booking-link" padding="sm" className="scroll-mt-24">
      <p className="text-sm text-frz-ink/60 mb-2">{title}</p>

      {showEditor ? (
        <p className="text-xs text-frz-ink/40 mb-3">
          Poți alege un nume personalizat. Linkurile deja distribuite rămân
          valabile și redirecționează automat către cel nou.
        </p>
      ) : (
        <p className="text-xs text-frz-ink/40 mb-3">
          Linkul frumos se creează o singură dată (din numele salonului/frizerului)
          și nu se schimbă când îți actualizezi numele. Îl poți trimite clienților
          fără griji.
        </p>
      )}

      {!url ? (
        <p className="text-red-600 text-sm">Link indisponibil momentan.</p>
      ) : (
        <div className="flex flex-col md:flex-row gap-2">
          <AdminInput
            value={url}
            readOnly
            className="py-2 text-sm bg-frz-fog truncate"
          />

          <div className="flex gap-2">
            <AdminButton
              size="sm"
              onClick={copyLink}
              saved={copied}
              savedLabel="Copiat!"
              className="flex-1"
            >
              Copiază
            </AdminButton>

            <AdminButton
              variant="secondary"
              size="sm"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1"
              onClick={markShared}
            >
              Deschide
            </AdminButton>
          </div>
        </div>
      )}

      {showEditor && appUrl && tenantSlug && (
        <BookingLinkEditor
          appUrl={appUrl}
          tenantSlug={tenantSlug}
          barberSlug={barberSlug ?? null}
          canEditTenantSlug={canEditTenantSlug}
          canEditBarberSlug={canEditBarberSlug}
          onSaved={(nextUrl) => setUrl(nextUrl)}
        />
      )}
    </AdminCard>
  );
}

function BookingLinkEditor({
  appUrl,
  tenantSlug,
  barberSlug,
  canEditTenantSlug,
  canEditBarberSlug,
  onSaved,
}: {
  appUrl: string;
  tenantSlug: string;
  barberSlug: string | null;
  canEditTenantSlug: boolean;
  canEditBarberSlug: boolean;
  onSaved: (url: string) => void;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    updateBookingLink,
    initialSaveFormState as BookingLinkFormState,
  );
  const [tenantValue, setTenantValue] = useState(tenantSlug);
  const [barberValue, setBarberValue] = useState(barberSlug || "");
  const [tenantAvailability, setTenantAvailability] = useState<Availability>({
    status: "idle",
  });
  const [barberAvailability, setBarberAvailability] = useState<Availability>({
    status: "idle",
  });

  const host = displayHost(appUrl);

  useEffect(() => {
    if (!state.success) return;
    const nextTenant = state.tenantSlug || tenantSlug;
    const nextBarber = state.barberSlug || barberSlug;
    if (state.tenantSlug) setTenantValue(state.tenantSlug);
    if (state.barberSlug) setBarberValue(state.barberSlug);
    onSaved(
      nextBarber
        ? publicBookingUrl(nextTenant, nextBarber, appUrl)
        : publicSalonUrl(nextTenant, appUrl),
    );
    router.refresh();
    // savedAt changes on every successful save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success, state.savedAt]);

  return (
    <form action={formAction} className="mt-4 space-y-3 border-t border-frz-line pt-4">
      <p className="text-sm font-medium text-frz-ink">Personalizează linkul</p>
      <p className="text-xs text-frz-ink/50">
        {host}/booking/salon/
        {canEditTenantSlug ? "nume-salon" : tenantSlug}
        {barberSlug != null || canEditBarberSlug ? "/nume-frizer" : ""}
      </p>

      <div className="flex flex-col gap-3">
        {canEditTenantSlug && (
          <SlugField
            name="tenant_slug"
            label="Nume salon în link"
            value={tenantValue}
            kind="tenant"
            availability={tenantAvailability}
            onAvailability={setTenantAvailability}
            onChange={setTenantValue}
          />
        )}

        {canEditBarberSlug && (
          <SlugField
            name="barber_slug"
            label="Nume frizer în link"
            value={barberValue}
            kind="barber"
            availability={barberAvailability}
            onAvailability={setBarberAvailability}
            onChange={setBarberValue}
          />
        )}
      </div>

      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-emerald-500">
          Linkul a fost actualizat. Linkurile vechi redirecționează automat.
        </p>
      )}

      <FormSaveButton
        label="Salvează linkul"
        savedLabel="Salvat ✔"
        saved={state.success}
      />
    </form>
  );
}

function SlugField({
  name,
  label,
  value,
  kind,
  availability,
  onAvailability,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  kind: BookingSlugKind;
  availability: Availability;
  onAvailability: (value: Availability) => void;
  onChange: (value: string) => void;
}) {
  useEffect(() => {
    const draft = value.trim();
    if (!draft) {
      onAvailability({ status: "idle" });
      return;
    }

    onAvailability({ status: "checking" });
    const timer = window.setTimeout(async () => {
      const result = await checkBookingLinkSlug({ kind, slug: draft });
      if (result.error && !result.available) {
        onAvailability({ status: "error", message: result.error });
        return;
      }
      onAvailability({
        status: "ok",
        message: result.current ? "Este linkul tău actual." : "Numele este disponibil.",
      });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [kind, onAvailability, value]);

  return (
    <div>
      <label className="block text-sm text-frz-ink/60 mb-2" htmlFor={name}>
        {label}
      </label>
      <AdminInput
        id={name}
        name={name}
        value={value}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        className="py-2 text-sm font-mono lowercase"
        aria-invalid={availability.status === "error"}
        aria-describedby={`${name}-status`}
      />
      <p
        id={`${name}-status`}
        className={`mt-1 text-xs ${
          availability.status === "error"
            ? "text-red-400"
            : availability.status === "ok"
              ? "text-emerald-500"
              : "text-frz-ink/40"
        }`}
      >
        {availability.status === "checking"
          ? "Verific disponibilitatea..."
          : availability.message || "Litere, cifre și cratime. Minim 3 caractere."}
      </p>
    </div>
  );
}
