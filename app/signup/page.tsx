"use client";

import { useState } from "react";

export default function SignupPage() {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    setLoading(true);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    const data = await res.json();

    setLoading(false);

    if (data.error) {
      alert(data.error);
      return;
    }

    // 🔥 IMPORTANT: redirect direct
    window.location.href = data.redirect;
  }

  return (
    <div className="max-w-md mx-auto mt-20 space-y-4">
      <h2 className="text-2xl font-semibold text-center">Creare cont</h2>

      <input
        placeholder="Nume complet"
        className="w-full border p-2 rounded"
        onChange={(e) =>
          setForm({ ...form, fullName: e.target.value })
        }
      />

      <input
        placeholder="Email"
        className="w-full border p-2 rounded"
        onChange={(e) =>
          setForm({ ...form, email: e.target.value })
        }
      />

      <input
        placeholder="Telefon"
        className="w-full border p-2 rounded"
        onChange={(e) =>
          setForm({ ...form, phone: e.target.value })
        }
      />

      <input
        type="password"
        placeholder="Parola"
        className="w-full border p-2 rounded"
        onChange={(e) =>
          setForm({ ...form, password: e.target.value })
        }
      />

      <button
        onClick={handleSignup}
        disabled={loading}
        className="w-full bg-black text-white py-2 rounded"
      >
        {loading ? "Se creează..." : "Creează cont"}
      </button>
    </div>
  );
}