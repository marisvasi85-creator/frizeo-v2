"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CONSENT_STORAGE_KEY,
  notifyConsentChange,
} from "@/lib/analytics/consent";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(CONSENT_STORAGE_KEY)) return;
    setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem(CONSENT_STORAGE_KEY, "accepted");
    notifyConsentChange();
    setVisible(false);
  }

  function decline() {
    localStorage.setItem(CONSENT_STORAGE_KEY, "essential");
    notifyConsentChange();
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Consimțământ cookies"
      className="fixed bottom-0 left-0 right-0 z-[100] p-4 md:p-6"
    >
      <div className="max-w-4xl mx-auto bg-[#161618] border border-white/10 text-white rounded-xl p-5 shadow-2xl flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1 text-sm text-white/80">
          Folosim cookie-uri esențiale pentru autentificare. Dacă accepți, putem
          folosi și Meta Pixel, TikTok Pixel și Google Analytics pentru statistici
          anonime.{" "}
          <Link href="/cookies" className="text-blue-400 underline">
            Politica cookies
          </Link>
          .
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={decline}
            className="px-4 py-2 rounded-lg text-sm bg-white/10 hover:bg-white/15"
          >
            Doar esențiale
          </button>
          <button
            type="button"
            onClick={accept}
            className="px-4 py-2 rounded-lg text-sm bg-white text-black font-medium"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
