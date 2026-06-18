"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = createSupabaseBrowserClient();

  const [password, setPassword] = useState("");

  useEffect(() => {
  console.log(window.location.href);
}, []);

  async function updatePassword() {
    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      alert("Eroare");
      return;
    }

    alert("Parola schimbată");
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white px-4">

      <div className="bg-zinc-900 p-6 rounded-xl space-y-4 w-full max-w-sm">

        <h2 className="text-lg font-semibold">
          Setează parola nouă
        </h2>

        <input
          type="password"
          placeholder="Parolă nouă"
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-zinc-800 p-3 rounded"
        />

        <button
          onClick={updatePassword}
          className="w-full bg-white text-black py-2 rounded"
        >
          Salvează
        </button>

      </div>
    </div>
  );
}