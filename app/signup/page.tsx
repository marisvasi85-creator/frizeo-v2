"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import PasswordRequirements from "@/app/components/auth/PasswordRequirements";
import {
  isValidEmail,
  isValidPassword,
  PASSWORD_REQUIREMENTS_MESSAGE,
} from "@/lib/auth/credentials";
import { hasAnalyticsConsent } from "@/lib/analytics/consent";
import {
  getFirstPartyAnalyticsContext,
  trackFirstPartyEventOnce,
} from "@/lib/analytics/firstParty";
import { trackRegistrationOnce } from "@/lib/analytics/track";
import SignupAnalytics from "@/app/components/analytics/SignupAnalytics";

type BusinessType = "independent" | "salon";
type SignupStep = 1 | 2;

const inputClassName =
  "w-full bg-frz-fog text-frz-ink placeholder-frz-ink/40 rounded-lg px-4 py-3 outline-none border border-frz-line focus:ring-2 focus:ring-frz-ink/10";

export default function SignupPage() {
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<SignupStep>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [actsAsBarber, setActsAsBarber] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  function validateStep1() {
    const form = getFormValues();

    if (!form.fullName || form.fullName.length < 2) {
      showError("Introdu numele complet.");
      return false;
    }

    if (!isValidEmail(form.email)) {
      showError("Email invalid.");
      return false;
    }

    if (!form.phone || form.phone.replace(/\D/g, "").length < 6) {
      showError("Introdu un număr de telefon valid.");
      return false;
    }

    if (!isValidPassword(form.password)) {
      showError(PASSWORD_REQUIREMENTS_MESSAGE);
      return false;
    }

    if (form.password !== form.confirmPassword) {
      showError("Parolele nu coincid.");
      return false;
    }

    return true;
  }

  function goToStep2() {
    setError("");
    if (!validateStep1()) return;
    setStep(2);
  }

  async function handleSignup(event?: React.FormEvent) {
    event?.preventDefault();
    setError("");

    if (step === 1) {
      goToStep2();
      return;
    }

    const form = getFormValues();

    if (!validateStep1()) {
      setStep(1);
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

    const analyticsContext = getFirstPartyAnalyticsContext();
    if (analyticsContext) {
      void trackFirstPartyEventOnce("lead", "signup_submit", {
        business_type: businessType,
        acts_as_barber: resolvedActsAsBarber,
      });
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
          marketingConsent,
          businessType,
          actsAsBarber: resolvedActsAsBarber,
          analyticsContext,
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
        await trackRegistrationOnce();
      }

      window.location.href = data.redirect;
    } catch {
      showError("Eroare server. Încearcă din nou.");
    } finally {
      setLoading(false);
    }
  }

  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;

  return (
    <div className="min-h-screen flex items-center justify-center bg-frz-fog px-4 py-10 pb-32">
      <SignupAnalytics />
      <div className="w-full max-w-sm bg-frz-card border border-frz-line rounded-2xl p-6 shadow-frz space-y-6">
        <div className="text-center">
          <h1 className="text-frz-ink text-2xl font-semibold">Frizeo</h1>
          <p className="text-frz-ink/60 text-sm mt-1">Creează cont</p>
          <p className="text-frz-ink/50 text-xs mt-2">Pasul {step} din 2</p>
          <div className="mt-3 flex gap-1.5" aria-hidden="true">
            <span
              className={`h-1 flex-1 rounded-full ${
                step >= 1 ? "bg-frz-ink" : "bg-frz-line"
              }`}
            />
            <span
              className={`h-1 flex-1 rounded-full ${
                step >= 2 ? "bg-frz-ink" : "bg-frz-line"
              }`}
            />
          </div>
        </div>

        <form ref={formRef} onSubmit={handleSignup} className="space-y-3">
          <div className={step === 1 ? "space-y-3" : "hidden"}>
            <input
              name="fullName"
              placeholder="Nume complet"
              autoComplete="name"
              className={inputClassName}
            />

            <input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="Email"
              className={inputClassName}
            />

            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="Telefon"
              className={inputClassName}
            />

            <div className="space-y-2 pt-1">
              <p className="text-sm font-medium text-frz-ink">
                Setează o parolă
              </p>
              <PasswordInput
                name="password"
                placeholder="Parolă"
                autoComplete="new-password"
                visible={showPassword}
                onToggleVisible={() => setShowPassword((value) => !value)}
                value={password}
                onChange={setPassword}
              />
              <PasswordInput
                name="confirmPassword"
                placeholder="Confirmă parola"
                autoComplete="new-password"
                visible={showConfirmPassword}
                onToggleVisible={() =>
                  setShowConfirmPassword((value) => !value)
                }
                value={confirmPassword}
                onChange={setConfirmPassword}
              />
              <PasswordRequirements password={password} />
              {confirmPassword.length > 0 && (
                <p
                  className={`text-sm ${
                    passwordsMatch ? "text-emerald-600" : "text-frz-ink/40"
                  }`}
                >
                  {passwordsMatch
                    ? "✓ parolele coincid"
                    : "✓ parolele trebuie să coincidă"}
                </p>
              )}
            </div>
          </div>

          <div className={step === 2 ? "space-y-3" : "hidden"}>
            <fieldset className="space-y-2 rounded-lg border border-frz-line bg-frz-fog p-3">
              <legend className="px-1 text-sm font-medium text-frz-ink">
                Cum vei folosi Frizeo
              </legend>
              <p className="text-xs text-frz-ink/60">
                Ca să știm ce dashboard să îți pregătim.
              </p>
              <label className="flex items-start gap-3 text-sm text-frz-ink/70 cursor-pointer">
                <input
                  type="radio"
                  name="businessType"
                  checked={businessType === "independent"}
                  onChange={() => selectBusinessType("independent")}
                  className="mt-1 h-4 w-4 shrink-0"
                />
                <span>
                  <span className="text-frz-ink font-medium">
                    Sunt frizer independent
                  </span>
                  <span className="block text-frz-ink/60 text-xs mt-0.5">
                    Lucrez pe cont propriu — dashboard Pro (1 loc, fără echipă).
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm text-frz-ink/70 cursor-pointer">
                <input
                  type="radio"
                  name="businessType"
                  checked={businessType === "salon"}
                  onChange={() => selectBusinessType("salon")}
                  className="mt-1 h-4 w-4 shrink-0"
                />
                <span>
                  <span className="text-frz-ink font-medium">
                    Lucrez într-un salon
                  </span>
                  <span className="block text-frz-ink/60 text-xs mt-0.5">
                    Administrez un salon / o echipă — trial Pro+ (până la 3
                    frizeri).
                  </span>
                </span>
              </label>
            </fieldset>

            {businessType === "salon" && (
              <fieldset className="space-y-2 rounded-lg border border-frz-line bg-frz-fog p-3">
                <legend className="px-1 text-sm text-frz-ink/70">
                  Rolul tău în salon
                </legend>
                <label className="flex items-start gap-3 text-sm text-frz-ink/70 cursor-pointer">
                  <input
                    type="radio"
                    name="actsAsBarber"
                    checked={actsAsBarber === true}
                    onChange={() => setActsAsBarber(true)}
                    className="mt-1 h-4 w-4 shrink-0"
                  />
                  <span>
                    <span className="text-frz-ink font-medium">
                      Sunt și frizer
                    </span>
                    <span className="block text-frz-ink/60 text-xs mt-0.5">
                      Administrez salonul și apar la programări (ocupă 1 loc din
                      3).
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 text-sm text-frz-ink/70 cursor-pointer">
                  <input
                    type="radio"
                    name="actsAsBarber"
                    checked={actsAsBarber === false}
                    onChange={() => setActsAsBarber(false)}
                    className="mt-1 h-4 w-4 shrink-0"
                  />
                  <span>
                    <span className="text-frz-ink font-medium">
                      Doar administrez salonul
                    </span>
                    <span className="block text-frz-ink/60 text-xs mt-0.5">
                      Nu apar la programări. Poți invita până la 3 frizeri.
                    </span>
                  </span>
                </label>
              </fieldset>
            )}

            <label className="flex items-start gap-3 text-sm text-frz-ink/60 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-frz-line"
              />
              <span>
                Accept{" "}
                <Link
                  href="/terms"
                  target="_blank"
                  className="text-frz-ink underline hover:no-underline"
                >
                  termenii și condițiile
                </Link>{" "}
                și{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  className="text-frz-ink underline hover:no-underline"
                >
                  politica de confidențialitate
                </Link>
                .
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm text-frz-ink/60 cursor-pointer">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-frz-line"
              />
              <span>
                Sunt de acord să primesc noutăți, sfaturi și oferte de la Frizeo
                prin email. Mă pot dezabona oricând.
              </span>
            </label>
          </div>

          {error && (
            <div
              ref={errorRef}
              role="alert"
              className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 text-center"
            >
              {error}
            </div>
          )}

          {step === 1 ? (
            <button
              type="submit"
              className="w-full bg-frz-ink text-frz-ink-contrast font-semibold py-3 rounded-lg hover:bg-frz-ink-soft transition"
            >
              Continuă
            </button>
          ) : (
            <div className="space-y-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-frz-ink text-frz-ink-contrast font-semibold py-3 rounded-lg hover:bg-frz-ink-soft transition disabled:opacity-50"
              >
                {loading ? "Se creează..." : "Creează cont"}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setError("");
                  setStep(1);
                }}
                className="w-full py-2 text-sm text-frz-ink/70 hover:text-frz-ink transition disabled:opacity-50"
              >
                Înapoi
              </button>
            </div>
          )}
        </form>

        <div className="text-center text-sm text-frz-ink/60">
          Ai deja cont?{" "}
          <Link href="/login" className="text-frz-ink hover:underline">
            Autentificare
          </Link>
        </div>
      </div>
    </div>
  );
}

function PasswordInput({
  name,
  placeholder,
  autoComplete,
  visible,
  onToggleVisible,
  value,
  onChange,
}: {
  name: string;
  placeholder: string;
  autoComplete: string;
  visible: boolean;
  onToggleVisible: () => void;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <input
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClassName} pr-12`}
      />
      <button
        type="button"
        onClick={onToggleVisible}
        aria-label={visible ? "Ascunde parola" : "Arată parola"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-frz-ink/40 hover:text-frz-ink/70"
      >
        {visible ? (
          <EyeOff className="h-5 w-5" strokeWidth={1.75} />
        ) : (
          <Eye className="h-5 w-5" strokeWidth={1.75} />
        )}
      </button>
    </div>
  );
}
