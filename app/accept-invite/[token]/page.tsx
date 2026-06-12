"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();

  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [error, setError] = useState("");

  useEffect(() => {
    async function loadInvitation() {
      try {
        const res = await fetch(
          `/api/barbers/accept-invite?token=${token}`
        );

        const data = await res.json();

        if (!res.ok || data.error) {
          setError(
            data.error || "Invitație invalidă"
          );
          return;
        }

        setFullName(
          data.invitation.full_name || ""
        );

        setEmail(
          data.invitation.email || ""
        );
      } catch {
        setError(
          "Nu s-a putut încărca invitația"
        );
      }

      setLoading(false);
    }

    loadInvitation();
  }, [token]);

  async function acceptInvite() {
    setError("");

    if (password.length < 6) {
      setError(
        "Parola trebuie să aibă minim 6 caractere"
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Parolele nu coincid");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(
        "/api/barbers/accept-invite",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            token,
            password,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(
          data.error ||
            "Nu s-a putut crea contul"
        );

        setSaving(false);
        return;
      }

      alert(
        "Cont creat cu succes. Te poți autentifica."
      );

      router.push("/login");
    } catch {
      setError("Eroare server");
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        Se încarcă...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">

      <div className="w-full max-w-sm bg-zinc-900 rounded-2xl p-6 shadow-xl space-y-4">

        <div className="text-center">
          <h1 className="text-white text-2xl font-semibold">
            Acceptă invitația
          </h1>

          <p className="text-zinc-400 text-sm mt-1">
            Creează contul de frizer
          </p>
        </div>

        {error && (
          <div className="text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <input
          value={fullName}
          disabled
          className="w-full bg-zinc-800 text-zinc-400 rounded-lg px-4 py-3"
        />

        <input
          value={email}
          disabled
          className="w-full bg-zinc-800 text-zinc-400 rounded-lg px-4 py-3"
        />

        <input
          type="password"
          placeholder="Parolă"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
          className="w-full bg-zinc-800 text-white rounded-lg px-4 py-3"
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
          className="w-full bg-zinc-800 text-white rounded-lg px-4 py-3"
        />

        <button
          onClick={acceptInvite}
          disabled={saving}
          className="w-full bg-white text-black font-medium py-3 rounded-lg"
        >
          {saving
            ? "Se creează..."
            : "Acceptă invitația"}
        </button>

      </div>

    </div>
  );
}