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

type BusinessType = "independent" | "salon";

export default function SignupPage() {
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [actsAsBarber, setActsAsBarber] = useState<boolean | null>(null);

  function showError(message: string) {
    setError(message);
    // Pe mobil formularul e lung — eroarea de sus nu e vizibilă lângă buton.
    queueMicrotask(() => {
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

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

  function selectBusinessType(next: BusinessType) {
    setBusinessType(next);
    setError("");
    if (next === "independent") {
      setActsAsBarber(true);
    } else if (actsAsBarber === true && businessType === "independent") {
      // Switching from independent → salon: ask role again.
      setActsAsBarber(null);
    }
  }

  async function handleSignup(event?: React.FormEvent) {
    event?.preventDefault();
    setError("");

    const form = getFormValues();

    if (!form.fullName || form.fullName.length < 2) {
      showError("Introdu numele complet.");
      return;
    }

    if (!isValidEmail(form.email)) {
      showError("Email invalid.");
      return;
    }

    if (!form.phone || form.phone.replace(/\D/g, "").length < 6) {
      showError("Introdu un număr de telefon valid.");
      return;
    }

    if (!isValidPassword(form.password)) {
      showError(PASSWORD_REQUIREMENTS_MESSAGE);
      return;
    }

    if (form.password !== form.confirmPassword) {
      showError("Parolele nu coincid.");
      return;
    }

    if (!acceptedTerms) {
      showError(
        "Trebuie să accepți termenii și condițiile și politica de confidențialitate.",
      );
      return;
    }

    if (businessType === null) {
      showError("Alege dacă ești frizer independent sau lucrezi într-un salon.");
      return;
    }

    if (businessType === "salon" && actsAsBarber === null) {
      showError("Alege dacă ești și frizer sau doar administrezi salonul.");
      return;
    }

    const resolvedActsAsBarber =
      businessType === "independent" ? true : Boolean(actsAsBarber);

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
          marketingConsent,
          businessType,
          actsAsBarber: resolvedActsAsBarber,
        }),
      });

      let data: { error?: string; redirect?: string } = {};
      try {
        data = await res.json();
      } catch {
        showError("Răspuns invalid de la server. Încearcă din nou.");
        return;
      }

      if (!res.ok || data.error) {
        showError(data.error || "Nu s-a putut crea contul. Încearcă din nou.");
        return;
      }

      if (!data.redirect) {
        showError(
          "Contul pare creat, dar redirecționarea a eșuat. Mergi la Autentificare.",
        );
        return;
      }

      if (hasAnalyticsConsent()) {
        trackRegistrationOnce();
      }

      window.location.href = data.redirect;
    } catch {
      showError("Eroare server. Încearcă din nou.");
    } finally {
      setLoading(false);
    }
  }

  const trialHint =
    businessType === "independent"
      ? "Trial Pro — un frizer, SMS reminder, fără invitații echipă."
      : businessType === "salon"
        ? "Trial Pro+ — până la 3 frizeri, invitații, SMS reminder."
        : "Alege tipul de activitate ca să vedem ce trial ți se potrivește.";

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4 py-10 pb-32">
      <SignupAnalytics />
      <div className="w-full max-w-sm bg-zinc-900 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="text-center">
          <h1 className="text-white text-2xl font-semibold">Frizeo</h1>
          <p className="text-zinc-400 text-sm mt-1">Creează cont</p>
          <p className="text-zinc-500 text-xs mt-2">{trialHint}</p>
        </div>

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
              Cum lucrezi?
            </legend>
            <label className="flex items-start gap-3 text-sm text-zinc-300 cursor-pointer">
              <input
                type="radio"
                name="businessType"
                checked={businessType === "independent"}
                onChange={() => selectBusinessType("independent")}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <span>
                <span className="text-white font-medium">
                  Sunt frizer independent
                </span>
                <span className="block text-zinc-500 text-xs mt-0.5">
                  Lucrez pe cont propriu — dashboard Pro (1 loc, fără echipă).
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-zinc-300 cursor-pointer">
              <input
                type="radio"
                name="businessType"
                checked={businessType === "salon"}
                onChange={() => selectBusinessType("salon")}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <span>
                <span className="text-white font-medium">
                  Lucrez într-un salon
                </span>
                <span className="block text-zinc-500 text-xs mt-0.5">
                  Administrez un salon / o echipă — trial Pro+ (până la 3
                  frizeri).
                </span>
              </span>
            </label>
          </fieldset>

          {businessType === "salon" && (
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
                    Administrez salonul și apar la programări (ocupă 1 loc din
                    3).
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
                  <span className="text-white font-medium">
                    Doar administrez salonul
                  </span>
                  <span className="block text-zinc-500 text-xs mt-0.5">
                    Nu apar la programări. Poți invita până la 3 frizeri.
                  </span>
                </span>
              </label>
            </fieldset>
          )}

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

          <label className="flex items-start gap-3 text-sm text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(e) => setMarketingConsent(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-600"
            />
            <span>
              Sunt de acord să primesc noutăți, sfaturi și oferte de la Frizeo
              prin email. Mă pot dezabona oricând.
            </span>
          </label>

          {error && (
            <div
              ref={errorRef}
              role="alert"
              className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg p-3 text-center"
            >
              {error}
            </div>
          )}

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
          new FormData(formRef.current ?? undefined).get("password") ?? "",
        );
        setPassword(value);
      }}
    >
      <PasswordRequirements password={password} />
    </div>
  );
}
