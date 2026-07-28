"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import PasswordRequirements from "@/app/components/auth/PasswordRequirements";
import {
  isValidEmail,
  isValidPassword,
  PASSWORD_REQUIREMENTS_MESSAGE,
} from "@/lib/auth/credentials";
import { hasAnalyticsConsent } from "@/lib/analytics/consent";
import { trackRegistrationOnce } from "@/lib/analytics/track";
import SignupAnalytics from "@/app/components/analytics/SignupAnalytics";

export default function SignupPage() {
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [actsAsBarber, setActsAsBarber] = useState<boolean | null>(null);

  function getFormValues() {
    const form = formRef.current;
    if (!form) {
      return {
        fullName: "",
        email: "",
        phone: "",
        password: "",
        confirmPassword: "",
      };
    }

    const data = new FormData(form);
    return {
      fullName: String(data.get("fullName") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      phone: String(data.get("phone") ?? "").trim(),
      password: String(data.get("password") ?? ""),
      confirmPassword: String(data.get("confirmPassword") ?? ""),
    };
  }

  async function handleSignup(event?: React.FormEvent) {
    event?.preventDefault();
    setError("");

    const form = getFormValues();

    if (!form.fullName || form.fullName.length < 2) {
      setError("Introdu numele complet.");
      return;
    }

    if (!isValidEmail(form.email)) {
      setError("Email invalid.");
      return;
    }

    if (!form.phone || form.phone.replace(/\D/g, "").length < 6) {
      setError("Introdu un număr de telefon valid.");
      return;
    }

    if (!isValidPassword(form.password)) {
      setError(PASSWORD_REQUIREMENTS_MESSAGE);
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Parolele nu coincid.");
      return;
    }

    if (!acceptedTerms) {
      setError(
        "Trebuie să accepți termenii și condițiile și politica de confidențialitate."
      );
      return;
    }

    if (actsAsBarber === null) {
      setError("Alege dacă ești și frizer sau doar administrezi salonul.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          password: form.password,
          acceptedTerms: true,
          actsAsBarber,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      if (hasAnalyticsConsent()) {
        trackRegistrationOnce();
      }

      window.location.href = data.redirect;
    } catch {
      setError("Eroare server. Încearcă din nou.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4 py-10 pb-32">
      <SignupAnalytics />
      <div className="w-full max-w-sm bg-zinc-900 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="text-center">
          <h1 className="text-white text-2xl font-semibold">Frizeo</h1>
          <p className="text-zinc-400 text-sm mt-1">Creează cont salon</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg p-3 text-center">
            {error}
          </div>
        )}

        <form ref={formRef} onSubmit={handleSignup} className="space-y-3">
          <input
            name="fullName"
            placeholder="Nume complet"
            autoComplete="name"
            className="w-full bg-zinc-800 text-white placeholder-zinc-500 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-white/20"
          />

          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Email"
            className="w-full bg-zinc-800 text-white placeholder-zinc-500 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-white/20"
          />

          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="Telefon"
            className="w-full bg-zinc-800 text-white placeholder-zinc-500 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-white/20"
          />

          <input
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Parolă"
            className="w-full bg-zinc-800 text-white placeholder-zinc-500 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-white/20"
          />

          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Confirmă parola"
            className="w-full bg-zinc-800 text-white placeholder-zinc-500 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-white/20"
          />

          <PasswordRequirementsField formRef={formRef} />

          <fieldset className="space-y-2 rounded-lg border border-zinc-700 p-3">
            <legend className="px-1 text-sm text-zinc-300">
              Rolul tău în salon
            </legend>
            <label className="flex items-start gap-3 text-sm text-zinc-300 cursor-pointer">
              <input
                type="radio"
                name="actsAsBarber"
                checked={actsAsBarber === true}
                onChange={() => setActsAsBarber(true)}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <span>
                <span className="text-white font-medium">Sunt și frizer</span>
                <span className="block text-zinc-500 text-xs mt-0.5">
                  Administrez salonul și apar la programări (ocupă 1 loc).
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-zinc-300 cursor-pointer">
              <input
                type="radio"
                name="actsAsBarber"
                checked={actsAsBarber === false}
                onChange={() => setActsAsBarber(false)}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <span>
                <span className="text-white font-medium">Doar administrez</span>
                <span className="block text-zinc-500 text-xs mt-0.5">
                  Nu apar la programări. Poți invita frizeri sau activa opțiunea
                  mai târziu.
                </span>
              </span>
            </label>
          </fieldset>

          <label className="flex items-start gap-3 text-sm text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-600"
            />
            <span>
              Accept{" "}
              <Link
                href="/terms"
                target="_blank"
                className="text-white underline hover:no-underline"
              >
                termenii și condițiile
              </Link>{" "}
              și{" "}
              <Link
                href="/privacy"
                target="_blank"
                className="text-white underline hover:no-underline"
              >
                politica de confidențialitate
              </Link>
              .
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-medium py-3 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
          >
            {loading ? "Se creează..." : "Creează cont"}
          </button>
        </form>

        <div className="text-center text-sm text-zinc-500">
          Ai deja cont?{" "}
          <Link href="/login" className="text-white hover:underline">
            Autentificare
          </Link>
        </div>
      </div>
    </div>
  );
}

function PasswordRequirementsField({
  formRef,
}: {
  formRef: React.RefObject<HTMLFormElement | null>;
}) {
  const [password, setPassword] = useState("");

  return (
    <div
      onInput={() => {
        const value = String(
          new FormData(formRef.current ?? undefined).get("password") ?? ""
        );
        setPassword(value);
      }}
    >
      <PasswordRequirements password={password} />
    </div>
  );
}
