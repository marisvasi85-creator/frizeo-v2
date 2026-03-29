"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
  });

  async function handleSignup() {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(form),
    });

    const data = await res.json();

    if (data.error) {
      alert(data.error);
      return;
    }

    router.push(data.redirect);
  }

  return (
    <div>
      <h2>Creare cont</h2>

      <input placeholder="Nume complet"
        onChange={(e) => setForm({ ...form, fullName: e.target.value })} />

      <input placeholder="Email"
        onChange={(e) => setForm({ ...form, email: e.target.value })} />

      <input placeholder="Telefon"
        onChange={(e) => setForm({ ...form, phone: e.target.value })} />

      <input type="password" placeholder="Parola"
        onChange={(e) => setForm({ ...form, password: e.target.value })} />

      <button onClick={handleSignup}>Creează cont</button>
    </div>
  );
}