"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black px-6 text-center text-white">
      <h1 className="text-2xl font-semibold">Ceva nu a mers</h1>
      <p className="mt-3 max-w-md text-sm text-white/60">
        A apărut o eroare neașteptată. Poți reîncerca sau te poți întoarce la
        pagina principală.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black"
        >
          Reîncearcă
        </button>
        <Link
          href="/"
          className="rounded-lg border border-white/20 px-5 py-2.5 text-sm text-white/80"
        >
          Acasă
        </Link>
      </div>
    </div>
  );
}
