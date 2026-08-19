"use client";

import { useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import PasswordRequirements from "@/app/components/auth/PasswordRequirements";
import {
  isValidPassword,
  PASSWORD_REQUIREMENTS_MESSAGE,
} from "@/lib/auth/credentials";

export default function ResetPasswordPage() {
  const supabase = createSupabaseBrowserClient();
  const formRef = useRef<HTMLFormElement>(null);

  const [passwordPreview, setPasswordPreview] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function getFormValues() {
    const form = formRef.current;
    if (!form) {
      return { password: "", confirmPassword: "" };
    }

    const data = new FormData(form);
    return {
      password: String(data.get("password") ?? ""),
      confirmPassword: String(data.get("confirmPassword") ?? ""),
    };
  }

  async function updatePassword(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const { password, confirmPassword } = getFormValues();

    if (!isValidPassword(password)) {
      setError(PASSWORD_REQUIREMENTS_MESSAGE);
      return;
    }

    if (password !== confirmPassword) {
      setError("Parolele introduse nu coincid.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(
        error.message ||
          "Nu am putut schimba parola. Linkul poate fi expirat — solicită unul nou."
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
    <div className="min-h-screen flex items-center justify-center bg-frz-fog px-4 py-10 pb-32">
      <div className="bg-white border border-frz-line p-6 rounded-xl space-y-4 w-full max-w-sm shadow-frz">
        <div>
          <h2 className="text-xl font-semibold text-frz-ink">
            Setează parola nouă
          </h2>
          <p className="text-sm text-frz-ink/60 mt-1">
            Alege o parolă sigură pentru contul tău Frizeo.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg p-3">
            {success}
          </div>
        )}

        <form
          ref={formRef}
          onSubmit={updatePassword}
          className="space-y-4"
          onInput={() => {
            const { password } = getFormValues();
            setPasswordPreview(password);
          }}
        >
          <input
            name="password"
            type="password"
            placeholder="Parolă nouă"
            autoComplete="new-password"
            className="w-full bg-frz-fog border border-frz-line p-3 rounded-lg text-frz-ink placeholder:text-frz-ink/40 outline-none focus:ring-2 focus:ring-frz-ink/10"
          />

          <input
            name="confirmPassword"
            type="password"
            placeholder="Confirmă parola"
            autoComplete="new-password"
            className="w-full bg-frz-fog border border-frz-line p-3 rounded-lg text-frz-ink placeholder:text-frz-ink/40 outline-none focus:ring-2 focus:ring-frz-ink/10"
          />

          {passwordPreview && (
            <PasswordRequirements password={passwordPreview} />
          )}

          <button
            type="submit"
            className="w-full bg-frz-ink text-white py-3 rounded-lg font-semibold hover:bg-frz-ink-soft transition"
          >
            Schimbă parola
          </button>
        </form>
      </div>
    </div>
  );
}
