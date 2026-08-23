"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  loadSavedClientDetails,
  saveSavedClientDetails,
} from "@/lib/bookings/savedClientDetails";
import type {
  BookingAccessMode,
  PublicAccessStatus,
} from "@/lib/barber-access/types";

type ClientDetails = {
  name: string;
  phone: string;
  email: string;
};

type Props = {
  barberId: string;
  mode: Exclude<BookingAccessMode, "open">;
  presentation: "modal" | "embedded";
  bookingHref?: string;
  onApproved?: (details: ClientDetails) => void;
  onStatusChange?: (status: PublicAccessStatus | null) => void;
};

const CLOSED_MESSAGE =
  "Acest profesionist nu acceptă momentan clienți noi. Programările sunt disponibile doar pentru clienții deja acceptați.";

export default function BookingAccessPrompt({
  barberId,
  mode,
  presentation,
  bookingHref,
  onApproved,
  onStatusChange,
}: Props) {
  const [open, setOpen] = useState(presentation === "embedded");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [referral, setReferral] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<PublicAccessStatus | null>(null);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const lastAutomaticCheck = useRef("");

  function updateStatus(nextStatus: PublicAccessStatus | null) {
    setStatus(nextStatus);
    onStatusChange?.(nextStatus);
  }

  function approve(details: ClientDetails) {
    saveSavedClientDetails(details);
    updateStatus("approved");
    setFeedback("Acces confirmat. Poți continua către programare.");
    onApproved?.(details);
    if (presentation === "modal") setOpen(false);
  }

  async function checkAccess(value: string, auto = false) {
    if (!value.trim()) return;

    try {
      if (!auto) setLoading(true);
      const response = await fetch("/api/public/barber-access/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barberId, phone: value }),
      });
      const data = await response.json();

      if (!response.ok) {
        if (!auto) setFeedback(data.error || "Nu am putut verifica accesul.");
        return;
      }

      updateStatus(data.status);
      if (data.canBook) {
        approve({ name, phone: value, email });
      } else if (!auto || data.status === "pending") {
        setFeedback(data.message || "Accesul nu este disponibil.");
      }
    } catch {
      if (!auto) setFeedback("Eroare de conexiune. Încearcă din nou.");
    } finally {
      if (!auto) setLoading(false);
    }
  }

  useEffect(() => {
    const saved = loadSavedClientDetails();
    if (!saved) return;

    const checkKey = `${barberId}:${mode}:${saved.phone}`;
    if (lastAutomaticCheck.current === checkKey) return;
    lastAutomaticCheck.current = checkKey;

    setName(saved.name);
    setPhone(saved.phone);
    setEmail(saved.email);

    const run = async () => {
      try {
        const response = await fetch("/api/public/barber-access/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ barberId, phone: saved.phone }),
        });
        const data = await response.json();
        if (!response.ok) return;

        const nextStatus = data.status as PublicAccessStatus | null;
        setStatus(nextStatus);
        onStatusChange?.(nextStatus);

        if (data.canBook) {
          saveSavedClientDetails(saved);
          setFeedback("Acces confirmat. Poți continua către programare.");
          onApproved?.(saved);
          if (presentation === "modal") setOpen(false);
        } else if (nextStatus === "pending") {
          setFeedback(data.message || "Cererea este în așteptare.");
        }
      } catch {
        // Verificarea automată este doar o optimizare. Formularul rămâne activ
        // pentru ca vizitatorul să poată relua manual verificarea.
      }
    };

    void run();
  }, [barberId, mode, onApproved, onStatusChange, presentation]);

  useEffect(() => {
    if (presentation !== "modal" || !open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, presentation]);

  async function submitRequest(event: React.FormEvent) {
    event.preventDefault();
    setFeedback("");

    if (mode === "approved_only") {
      await checkAccess(phone);
      return;
    }

    if (!name.trim() || !phone.trim()) {
      setFeedback("Completează numele și telefonul.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/public/barber-access/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barberId,
          name,
          phone,
          email,
          referral,
          message,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        if (data.status) updateStatus(data.status);
        setFeedback(data.error || "Nu am putut trimite solicitarea.");
        return;
      }

      saveSavedClientDetails({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
      });
      updateStatus(data.status);

      if (data.canBook) {
        approve({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
        });
      } else {
        setFeedback(data.message || "Cererea a fost trimisă.");
      }
    } catch {
      setFeedback("Eroare de conexiune. Încearcă din nou.");
    } finally {
      setLoading(false);
    }
  }

  if (status === "approved" && bookingHref) {
    return (
      <Link
        href={bookingHref}
        className="inline-flex justify-center rounded-xl bg-frz-ink px-4 py-2 text-sm font-medium text-frz-ink-contrast"
      >
        Alege
      </Link>
    );
  }

  if (presentation === "modal" && !open) {
    return (
      <button
        type="button"
        onClick={() => {
          setFeedback("");
          setOpen(true);
        }}
        disabled={status === "pending"}
        className="rounded-xl border border-frz-line bg-frz-card px-4 py-2 text-sm font-medium text-frz-ink transition hover:bg-frz-fog disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "pending"
          ? "Cerere în așteptare"
          : mode === "approval_required"
            ? "Înscrie-te"
            : "Sunt deja client"}
      </button>
    );
  }

  const form = (
    <form onSubmit={submitRequest} className="space-y-3">
      {mode === "approval_required" && status !== "pending" && (
        <>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nume complet"
            aria-label="Nume complet"
            autoComplete="name"
            autoFocus={presentation === "modal"}
            maxLength={160}
            required
            className="w-full rounded-xl border border-frz-line bg-frz-card p-3 text-frz-ink outline-none focus:border-frz-ink/30 focus:ring-2 focus:ring-frz-ink/10"
          />
        </>
      )}

      {status !== "pending" && (
        <input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="Telefon (07xxxxxxxx)"
          aria-label="Număr de telefon"
          type="tel"
          autoComplete="tel"
          autoFocus={presentation === "modal" && mode === "approved_only"}
          required
          className="w-full rounded-xl border border-frz-line bg-frz-card p-3 text-frz-ink outline-none focus:border-frz-ink/30 focus:ring-2 focus:ring-frz-ink/10"
        />
      )}

      {mode === "approval_required" && status !== "pending" && (
        <>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="E-mail (opțional)"
            aria-label="E-mail opțional"
            type="email"
            autoComplete="email"
            maxLength={320}
            className="w-full rounded-xl border border-frz-line bg-frz-card p-3 text-frz-ink outline-none focus:border-frz-ink/30 focus:ring-2 focus:ring-frz-ink/10"
          />
          <input
            value={referral}
            onChange={(event) => setReferral(event.target.value)}
            placeholder="Cine te-a recomandat? (opțional)"
            aria-label="Recomandare opțională"
            maxLength={240}
            className="w-full rounded-xl border border-frz-line bg-frz-card p-3 text-frz-ink outline-none focus:border-frz-ink/30 focus:ring-2 focus:ring-frz-ink/10"
          />
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Mesaj pentru frizer (opțional)"
            aria-label="Mesaj opțional pentru frizer"
            rows={3}
            maxLength={1200}
            className="w-full resize-y rounded-xl border border-frz-line bg-frz-card p-3 text-frz-ink outline-none focus:border-frz-ink/30 focus:ring-2 focus:ring-frz-ink/10"
          />
        </>
      )}

      {feedback && (
        <p
          role="status"
          className={`rounded-xl border p-3 text-sm ${
            status === "pending"
              ? "border-amber-300/50 bg-amber-500/10 text-frz-ink"
              : "border-frz-line bg-frz-fog text-frz-ink"
          }`}
        >
          {feedback}
        </p>
      )}

      {status !== "pending" && (
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-frz-ink px-4 py-3 font-medium text-frz-ink-contrast disabled:opacity-60"
        >
          {loading
            ? "Se verifică..."
            : mode === "approval_required"
              ? "Solicită acces"
              : "Verifică accesul"}
        </button>
      )}
    </form>
  );

  if (presentation === "embedded") {
    return (
      <section className="rounded-2xl border border-frz-line bg-frz-card p-5">
        <span className="inline-flex rounded-full bg-frz-fog px-2.5 py-1 text-xs font-medium text-frz-muted">
          {status === "pending"
            ? "Cerere în așteptare"
            : mode === "approval_required"
              ? "Acces pe bază de aprobare"
              : "Închis pentru clienți noi"}
        </span>
        <h2 className="text-lg font-semibold">
          {mode === "approval_required"
            ? "Programări pe bază de aprobare"
            : "Doar clienți acceptați"}
        </h2>
        <p className="mt-2 text-sm text-frz-muted">
          {mode === "approval_required"
            ? "Acest profesionist are disponibilitate limitată și acceptă momentan clienți noi pe bază de solicitare."
            : CLOSED_MESSAGE}
        </p>
        <div className="mt-4">{form}</div>
      </section>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`booking-access-${barberId}`}
      aria-describedby={`booking-access-description-${barberId}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) setOpen(false);
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-frz-line bg-frz-bg p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id={`booking-access-${barberId}`} className="text-xl font-semibold">
              {mode === "approval_required"
                ? "Solicită acces"
                : "Sunt deja client"}
            </h2>
            <p
              id={`booking-access-description-${barberId}`}
              className="mt-1 text-sm text-frz-muted"
            >
              {mode === "approval_required"
                ? "Completează datele, iar profesionistul îți va putea aproba solicitarea."
                : "Introdu numărul folosit la programările tale anterioare."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Închide"
            className="rounded-lg border border-frz-line px-3 py-1.5 text-frz-muted hover:bg-frz-fog"
          >
            ✕
          </button>
        </div>
        {form}
      </div>
    </div>
  );
}
