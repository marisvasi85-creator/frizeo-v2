"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isValidEmail } from "@/lib/auth/credentials";

export default function LoginPage() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [shake, setShake] = useState(false);

  function triggerError(msg: string) {
    setError(msg);
    setSuccess("");
    setShake(true);
    setTimeout(() => setShake(false), 400);
  }

  function getFormValues() {
    const form = formRef.current;
    if (!form) {
      return { email: "", password: "" };
    }

    const data = new FormData(form);
    return {
      email: String(data.get("email") ?? "").trim(),
      password: String(data.get("password") ?? ""),
    };
  }

  async function login(event?: React.FormEvent) {
    event?.preventDefault();
    setError("");
    setSuccess("");

    const { email, password } = getFormValues();

    if (!isValidEmail(email)) {
      triggerError("Email invalid.");
      return;
    }

    if (!password) {
      triggerError("Parola este obligatorie.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        triggerError(data.error || "Email sau parolă incorectă.");
        return;
      }

      window.location.href = "/admin/dashboard";
    } catch {
      triggerError("Eroare server. Încearcă din nou.");
    } finally {
      setLoading(false);
    }
  }

  async function forgotPassword() {
    setError("");
    setSuccess("");

    const { email } = getFormValues();

    if (!isValidEmail(email)) {
      triggerError("Introdu o adresă de email validă.");
      return;
    }

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      triggerError("Nu am putut trimite emailul de resetare.");
      return;
    }

    setSuccess(
      "Dacă există un cont asociat acestei adrese, am trimis un link de resetare. Verifică Inbox-ul și Spam-ul."
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-frz-fog px-4 py-10 pb-32">
      <div
        className={`w-full max-w-sm bg-frz-card rounded-2xl p-6 shadow-frz space-y-6 border border-frz-line ${
          shake ? "animate-shake" : ""
        }`}
      >
        <div className="text-center">
          <h1 className="text-frz-ink text-2xl font-semibold">Frizeo</h1>
          <p className="text-frz-ink/60 text-sm mt-1">Autentificare frizer</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 text-center">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg p-3 text-center">
            {success}
          </div>
        )}

        <form ref={formRef} onSubmit={login} className="space-y-4">
          <input
            name="email"
            type="email"
            placeholder="Email"
            autoComplete="email"
            className="w-full bg-frz-fog text-frz-ink placeholder-frz-ink/40 rounded-lg px-4 py-3 outline-none border border-frz-line focus:ring-2 focus:ring-frz-ink/10"
          />

          <input
            name="password"
            type="password"
            placeholder="Parolă"
            autoComplete="current-password"
            className="w-full bg-frz-fog text-frz-ink placeholder-frz-ink/40 rounded-lg px-4 py-3 outline-none border border-frz-line focus:ring-2 focus:ring-frz-ink/10"
          />

          <div className="flex justify-end text-sm text-frz-ink/60">
            <button
              type="button"
              onClick={forgotPassword}
              className="hover:text-frz-ink"
            >
              Ai uitat parola?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-frz-ink text-frz-ink-contrast font-semibold py-3 rounded-lg hover:bg-frz-ink-soft transition disabled:opacity-50"
          >
            {loading ? "Se autentifică..." : "Autentificare"}
          </button>
        </form>

        <div className="text-center text-sm text-frz-ink/60">
          Nu ai cont?{" "}
          <button
            type="button"
            onClick={() => router.push("/signup")}
            className="text-frz-ink hover:underline"
          >
            Creează cont
          </button>
        </div>
      </div>
    </div>
  );
}
