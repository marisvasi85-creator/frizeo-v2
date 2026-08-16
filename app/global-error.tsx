"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ro">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, margin: 0 }}>Ceva nu a mers</h1>
          <p style={{ color: "rgba(255,255,255,0.6)", marginTop: 12 }}>
            A apărut o eroare neașteptată.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 24,
              background: "#fff",
              color: "#000",
              border: 0,
              borderRadius: 8,
              padding: "10px 18px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reîncearcă
          </button>
        </div>
      </body>
    </html>
  );
}
