"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
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

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
triggerError(
  data.error ||
  "Email sau parolă incorectă."
);

return;
      }

      // 🔥 REDIRECT CORECT
      window.location.href = "/admin/dashboard";

    } catch (err) {
      triggerError("Eroare server");
    }

    setLoading(false);
  }

  async function forgotPassword() {
  setError("");
  setSuccess("");

  if (!isValidEmail(email)) {
    triggerError(
      "Introdu o adresă de email validă."
    );
    return;
  }

  const res = await fetch(
    "/api/auth/reset-password",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        email,
      }),
    }
  );

  const data = await res.json();

  if (!res.ok || data.error) {
    triggerError(
      "Nu am putut trimite emailul de resetare."
    );
    return;
  }

  setSuccess(
    "Dacă există un cont asociat acestei adrese de email, am trimis un link pentru resetarea parolei. Verifică Inbox-ul și Spam-ul."
  );
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
        {success && (
  <div
    className="
      bg-green-500/10
      border
      border-green-500/30
      text-green-300
      text-sm
      rounded-lg
      p-3
      text-center
    "
  >
    {success}
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