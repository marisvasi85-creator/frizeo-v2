"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = createSupabaseBrowserClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] =
    useState("");

  const passwordValid =
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password);

  async function updatePassword() {
    setError("");
    setSuccess("");

    if (!passwordValid) {
      setError(
        "Parola trebuie să conțină minim 8 caractere, o literă mare, o literă mică și o cifră."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        "Parolele introduse nu coincid."
      );
      return;
    }

    const { error } =
      await supabase.auth.updateUser({
        password,
      });

    if (error) {
      setError(
        error.message ||
          "Nu am putut schimba parola."
      );
      return;
    }

    setSuccess(
      "Parola a fost schimbată cu succes. Vei fi redirecționat către pagina de autentificare."
    );

    setTimeout(() => {
      window.location.href = "/login";
    }, 2500);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white px-4">

      <div className="bg-zinc-900 p-6 rounded-xl space-y-4 w-full max-w-sm">

        <div>
          <h2 className="text-xl font-semibold">
            Setează parola nouă
          </h2>

          <p className="text-sm text-zinc-400 mt-1">
            Alege o parolă sigură pentru
            contul tău Frizeo.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg p-3">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-300 text-sm rounded-lg p-3">
            {success}
          </div>
        )}

        <input
          type="password"
          placeholder="Parolă nouă"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
          className="w-full bg-zinc-800 p-3 rounded-lg"
        />

        <input
          type="password"
          placeholder="Confirmă parola"
          value={confirmPassword}
          onChange={(e) =>
            setConfirmPassword(
              e.target.value
            )
          }
          className="w-full bg-zinc-800 p-3 rounded-lg"
        />

        {confirmPassword &&
          password !== confirmPassword && (
            <p className="text-red-400 text-sm">
              Parolele nu coincid.
            </p>
          )}

        {confirmPassword &&
          password === confirmPassword && (
            <p className="text-green-400 text-sm">
              ✓ Parolele coincid
            </p>
          )}

        <div className="text-sm space-y-1">

          <p
            className={
              password.length >= 8
                ? "text-green-400"
                : "text-zinc-500"
            }
          >
            ✓ minim 8 caractere
          </p>

          <p
            className={
              /[A-Z]/.test(password)
                ? "text-green-400"
                : "text-zinc-500"
            }
          >
            ✓ o literă mare
          </p>

          <p
            className={
              /[a-z]/.test(password)
                ? "text-green-400"
                : "text-zinc-500"
            }
          >
            ✓ o literă mică
          </p>

          <p
            className={
              /\d/.test(password)
                ? "text-green-400"
                : "text-zinc-500"
            }
          >
            ✓ o cifră
          </p>

        </div>

        <button
          onClick={updatePassword}
          className="w-full bg-white text-black py-3 rounded-lg font-medium hover:bg-gray-200 transition"
        >
          Schimbă parola
        </button>

      </div>
    </div>
  );
}