"use client";

import { useEffect } from "react";

export default function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {
          // Install prompt still works with manual instructions on unsupported browsers.
        });
    };

    // Defer SW registration so first paint / navigation stay responsive.
    const idle =
      typeof window !== "undefined" && "requestIdleCallback" in window
        ? window.requestIdleCallback(register, { timeout: 4000 })
        : null;

    const timeoutId =
      idle == null ? window.setTimeout(register, 2500) : null;

    return () => {
      if (idle != null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idle);
      }
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  return null;
}
