"use client";

import { useState } from "react";

export default function SignupPage() {
  const [form, setForm] = useState({
  fullName: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
});

  const [loading, setLoading] = useState(false);
  const passwordValid =
  form.password.length >= 8 &&
  /[A-Z]/.test(form.password) &&
  /[a-z]/.test(form.password) &&
  /\d/.test(form.password);

  async function handleSignup() {
    setLoading(true);
    
    if (!passwordValid) {
  alert(
    "Parola trebuie să conțină minim 8 caractere, o literă mare, o literă mică și o cifră."
  );

  setLoading(false);
  return;
}

if (
  form.password !==
  form.confirmPassword
) {
  alert(
    "Parolele nu coincid."
  );

  setLoading(false);
  return;
}
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
  type="email"
  autoComplete="email"
  placeholder="Email"
  className="w-full border p-2 rounded"
  onChange={(e) =>
    setForm({
      ...form,
      email: e.target.value,
    })
  }
/>

      <input
        type="tel"
        autoComplete="tel"
        placeholder="Telefon"
        className="w-full border p-2 rounded"
        onChange={(e) =>
          setForm({ ...form, phone: e.target.value })
        }
      />

      <input
  type="password"
  autoComplete="new-password"
  placeholder="Parola"
  className="w-full border p-2 rounded"
  onChange={(e) =>
    setForm({
      ...form,
      password: e.target.value,
    })
  }
/>

      <input
  type="password"
  autoComplete="new-password"
  placeholder="Confirmă parola"
  className="w-full border p-2 rounded"
  onChange={(e) =>
    setForm({
      ...form,
      confirmPassword: e.target.value,
    })
  }
/>
<div className="text-sm space-y-1">

  <p
    className={
      form.password.length >= 8
        ? "text-green-600"
        : "text-gray-500"
    }
  >
    ✓ minim 8 caractere
  </p>

  <p
    className={
      /[A-Z]/.test(form.password)
        ? "text-green-600"
        : "text-gray-500"
    }
  >
    ✓ literă mare
  </p>

  <p
    className={
      /[a-z]/.test(form.password)
        ? "text-green-600"
        : "text-gray-500"
    }
  >
    ✓ literă mică
  </p>

  <p
    className={
      /\d/.test(form.password)
        ? "text-green-600"
        : "text-gray-500"
    }
  >
    ✓ cifră
  </p>

</div>
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