"use client";

import * as Sentry from "@sentry/nextjs";

export function SentryTestClient() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-start justify-center gap-4 px-6 text-white">
      <h1 className="text-xl font-semibold">Sentry test</h1>
      <p className="text-sm text-white/60">
        Pagina e disponibilă doar când SENTRY_ENABLE_TEST_ENDPOINT=true.
        Dezactivează variabila după test.
      </p>
      <button
        type="button"
        className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
        onClick={() => {
          Sentry.captureException(
            new Error("Sentry staging test error (client)"),
          );
          throw new Error("Sentry staging test error (client throw)");
        }}
      >
        Trigger client error
      </button>
    </main>
  );
}
