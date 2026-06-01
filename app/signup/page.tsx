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
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    const data = await res.json();

    if (data.error) {
      alert(data.error);
      return;
    }

    alert("Cont creat! Verifică email-ul pentru confirmare.");

    router.push("/login");
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
        className="w-full bg-black text-white py-2 rounded"
      >
        Creează cont
      </button>
    </div>
  );
}