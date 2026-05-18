"use client";

import { useState } from "react";
import Link from "next/link";

export default function CancelClient({ token }: { token: string }) {
  const [step, setStep] = useState<
    "confirm" | "loading" | "done" | "error"
  >("confirm");

  const [message, setMessage] = useState("");

  const handleCancel = async () => {
    setStep("loading");

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
        setStep("error");
        setMessage(data.error || "Eroare la anulare");
        return;
      }

      setStep("done");
      setMessage("Programarea a fost anulată cu succes");
    } catch (err) {
      console.error(err);
      setStep("error");
      setMessage("Eroare server");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center space-y-6">

        {step === "confirm" && (
          <>
            <h1 className="text-2xl font-semibold text-red-500">
              Anulezi programarea?
            </h1>

            <p className="text-gray-600">
              Ești sigur că vrei să anulezi această programare?
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="w-full bg-red-500 text-white p-3 rounded-xl"
              >
                Da, anulează
              </button>

              <Link
                href="/"
                className="w-full bg-gray-200 p-3 rounded-xl text-center"
              >
                Renunță
              </Link>
            </div>
          </>
        )}

        {step === "loading" && <p>Se procesează...</p>}

        {step === "done" && (
          <>
            <h1 className="text-2xl text-red-500 font-semibold">
              Programare anulată
            </h1>

            <p className="text-gray-600">{message}</p>

            <Link
              href="/"
              className="block bg-black text-white p-3 rounded-xl"
            >
              Înapoi
            </Link>
          </>
        )}

        {step === "error" && (
          <>
            <h1 className="text-2xl text-gray-700 font-semibold">
              Eroare
            </h1>

            <p className="text-gray-600">{message}</p>

            <Link
              href="/"
              className="block bg-black text-white p-3 rounded-xl"
            >
              Înapoi
            </Link>
          </>
        )}
      </div>
    </div>
  );
}