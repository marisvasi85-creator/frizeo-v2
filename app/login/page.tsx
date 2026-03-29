"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function LoginPage() {
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function login() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    router.push("/admin/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B0B0C] text-white">
      <div className="bg-[#161618] p-6 rounded-xl space-y-4 w-full max-w-sm">

        <h2 className="text-lg font-semibold">Login</h2>

        <input
          placeholder="Email"
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-[#0F0F10] border border-white/10 px-3 py-2 rounded"
        />

        <input
          type="password"
          placeholder="Parolă"
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-[#0F0F10] border border-white/10 px-3 py-2 rounded"
        />

        <button
          onClick={login}
          className="w-full bg-white text-black py-2 rounded"
        >
          Login
        </button>

      </div>
    </div>
  );
}