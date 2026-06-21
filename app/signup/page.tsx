"use client";

import { useState } from "react";
import Link from "next/link";

export default function SignupPage() {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const passwordValid =
    form.password.length >= 8 &&
    /[A-Z]/.test(form.password) &&
    /[a-z]/.test(form.password) &&
    /\d/.test(form.password);

  async function handleSignup() {
    setError("");

    if (!passwordValid) {
      setError(
        "Parola trebuie să conțină minim 8 caractere, o literă mare, o literă mică și o cifră."
      );
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Parolele nu coincid.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      window.location.href = data.redirect;
    } catch {
      setError("Eroare server. Încearcă din nou.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4 py-10">
      <div className="w-full max-w-sm bg-zinc-900 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="text-center">
          <h1 className="text-white text-2xl font-semibold">Frizeo</h1>
          <p className="text-zinc-400 text-sm mt-1">Creează cont frizer</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg p-3 text-center">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <input
            placeholder="Nume complet"
            className="w-full bg-zinc-800 text-white placeholder-zinc-500 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-white/20"
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />

          <input
            type="email"
            autoComplete="email"
            placeholder="Email"
            className="w-full bg-zinc-800 text-white placeholder-zinc-500 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-white/20"
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <input
            type="tel"
            autoComplete="tel"
            placeholder="Telefon"
            className="w-full bg-zinc-800 text-white placeholder-zinc-500 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-white/20"
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />

          <input
            type="password"
            autoComplete="new-password"
            placeholder="Parolă"
            className="w-full bg-zinc-800 text-white placeholder-zinc-500 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-white/20"
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          <input
            type="password"
            autoComplete="new-password"
            placeholder="Confirmă parola"
            className="w-full bg-zinc-800 text-white placeholder-zinc-500 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-white/20"
            onChange={(e) =>
              setForm({ ...form, confirmPassword: e.target.value })
            }
          />
        </div>

        <div className="text-sm space-y-1">
          <p className={form.password.length >= 8 ? "text-green-400" : "text-zinc-500"}>
            ✓ minim 8 caractere
          </p>
          <p className={/[A-Z]/.test(form.password) ? "text-green-400" : "text-zinc-500"}>
            ✓ literă mare
          </p>
          <p className={/[a-z]/.test(form.password) ? "text-green-400" : "text-zinc-500"}>
            ✓ literă mică
          </p>
          <p className={/\d/.test(form.password) ? "text-green-400" : "text-zinc-500"}>
            ✓ cifră
          </p>
        </div>

        <button
          type="button"
          onClick={handleSignup}
          disabled={loading}
          className="w-full bg-white text-black font-medium py-3 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
        >
          {loading ? "Se creează..." : "Creează cont"}
        </button>

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
