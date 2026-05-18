"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  function isValidEmail(email: string) {
    return /\S+@\S+\.\S+/.test(email);
  }

  function triggerError(msg: string) {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 400);
  }

  async function login() {
    setError("");

    if (!isValidEmail(email)) {
      triggerError("Email invalid");
      return;
    }

    if (!password) {
      triggerError("Parola este obligatorie");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      triggerError("Date incorecte");
      return;
    }

    router.push("/admin/dashboard");
    router.refresh();
  }

  async function forgotPassword() {
    if (!isValidEmail(email)) {
      triggerError("Introdu email valid");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      triggerError("Eroare la resetare");
      return;
    }

    alert("Verifică emailul pentru resetare parolă");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">

      <div
        className={`w-full max-w-sm bg-zinc-900 rounded-2xl p-6 shadow-xl space-y-6 ${
          shake ? "animate-shake" : ""
        }`}
      >

        {/* TITLE */}
        <div className="text-center">
          <h1 className="text-white text-2xl font-semibold">
            Frizeo
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Autentificare barber
          </p>
        </div>

        {/* ERROR */}
        {error && (
          <div className="text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* FORM */}
        <div className="space-y-4">

          {/* EMAIL */}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full bg-zinc-800 text-white placeholder-zinc-500 rounded-lg px-4 py-3 outline-none ${
              email && !isValidEmail(email)
                ? "ring-2 ring-red-500"
                : "focus:ring-2 focus:ring-white/20"
            }`}
          />

          {/* PASSWORD */}
          <input
            type="password"
            placeholder="Parolă"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-zinc-800 text-white placeholder-zinc-500 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-white/20"
          />

          {/* OPTIONS */}
          <div className="flex justify-between items-center text-sm text-zinc-400">

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={remember}
                onChange={() => setRemember(!remember)}
              />
              Ține-mă minte
            </label>

            <button
              onClick={forgotPassword}
              className="hover:underline"
            >
              Ai uitat parola?
            </button>

          </div>

          {/* BUTTON */}
          <button
            onClick={login}
            disabled={loading}
            className="w-full bg-white text-black font-medium py-3 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
          >
            {loading ? "Se autentifică..." : "Login"}
          </button>

        </div>

        {/* FOOTER */}
        <div className="text-center text-sm text-zinc-500">
          Nu ai cont?{" "}
          <span
            onClick={() => router.push("/signup")}
            className="text-white cursor-pointer hover:underline"
          >
            Creează cont
          </span>
        </div>

      </div>
    </div>
  );
}