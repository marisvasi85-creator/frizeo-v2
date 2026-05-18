"use client";

import Link from "next/link";

export default function RescheduleConfirmedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">

      <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center space-y-6">

        <div className="text-green-600 text-5xl">
          ✔
        </div>

        <h1 className="text-2xl font-semibold text-green-600">
          Reprogramare confirmată
        </h1>

        <p className="text-gray-600">
          Noua programare a fost salvată cu succes.
        </p>

        <p className="text-sm text-gray-400">
          Am trimis și un email de confirmare.
        </p>

        <Link
          href="/"
          className="block w-full bg-black text-white p-4 rounded-xl font-medium hover:opacity-90 transition"
        >
          Înapoi
        </Link>

      </div>
    </div>
  );
}