"use client";

import { useState } from "react";

type Props = {
  token: string;
};

export default function CancelClient({ token }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Nu s-a putut anula programarea");
        setLoading(false);
        return;
      }

      setMessage("Programarea a fost anulată cu succes.");
    } catch {
      setError("Eroare de rețea");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 420,
        margin: "40px auto",
        padding: 20,
        border: "1px solid #ddd",
        borderRadius: 8,
        textAlign: "center",
      }}
    >
      <h2>Anulare programare</h2>

      {!message && (
        <>
          <p>Sigur dorești să anulezi această programare?</p>

          <button
            onClick={handleCancel}
            disabled={loading}
            style={{
              padding: "10px 20px",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Se procesează..." : "Anulează programarea"}
          </button>
        </>
      )}

      {message && (
        <p style={{ color: "green", marginTop: 20 }}>{message}</p>
      )}

      {error && (
        <p style={{ color: "red", marginTop: 20 }}>{error}</p>
      )}
    </div>
  );
}
