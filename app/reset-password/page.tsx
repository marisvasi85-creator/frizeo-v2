"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = createSupabaseBrowserClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const passwordValid =
  password.length >= 8 &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password) &&
  /\d/.test(password);
  
  useEffect(() => {
  console.log(window.location.href);
}, []);

  async function updatePassword() {
    if (!passwordValid) {
  alert(
    "Parola trebuie să conțină minim 8 caractere, o literă mare, o literă mică și o cifră."
  );
  return;
}

if (password !== confirmPassword) {
  alert("Parolele nu coincid.");
  return;
}
    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
  console.error(error);

  alert(error.message);

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
        <input
  type="password"
  placeholder="Confirmă parola"
  onChange={(e) =>
    setConfirmPassword(e.target.value)
  }

  className="w-full bg-zinc-800 p-3 rounded"
/>
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
    ✓ literă mare
  </p>

  <p
    className={
      /[a-z]/.test(password)
        ? "text-green-400"
        : "text-zinc-500"
    }
  >
    ✓ literă mică
  </p>

  <p
    className={
      /\d/.test(password)
        ? "text-green-400"
        : "text-zinc-500"
    }
  >
    ✓ cifră
  </p>

</div>
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