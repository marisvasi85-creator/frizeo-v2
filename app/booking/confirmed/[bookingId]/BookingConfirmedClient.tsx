"use client";

export default function BookingConfirmed({ bookingId }: { bookingId: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">

      <h1 className="text-2xl font-semibold text-green-600">
        ✔ Programare confirmată
      </h1>

      <p className="mt-2 text-gray-600">
        Am trimis un email de confirmare.
      </p>

      <p className="text-sm text-gray-400">
        Verifică inbox / spam.
      </p>

    </div>
  );
}