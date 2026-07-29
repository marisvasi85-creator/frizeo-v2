"use client";

import { useState } from "react";
import AdminCard from "../components/AdminCard";
import AdminButton from "../components/AdminButton";
import { AdminInput } from "../components/AdminInput";
import { markSetupChecklistStep } from "@/lib/setup-checklist/storage";

export default function BookingLinkCard({
  initialUrl,
  barberId,
  title = "Linkul tău de programări",
}: {
  initialUrl: string;
  barberId?: string;
  title?: string;
}) {
  const [url] = useState(initialUrl);
  const [copied, setCopied] = useState(false);

  function markShared() {
    if (barberId) markSetupChecklistStep(barberId, "share_link");
  }

  async function copyLink() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    markShared();
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <AdminCard id="booking-link" padding="sm" className="mb-6 scroll-mt-24">
      <p className="text-sm text-white/60 mb-2">{title}</p>

      <p className="text-xs text-white/40 mb-3">
        Linkul frumos se creează o singură dată (din numele salonului/frizerului)
        și nu se schimbă când îți actualizezi numele. Îl poți trimite clienților
        fără griji.
      </p>

      {!url ? (
        <p className="text-red-400 text-sm">Link indisponibil momentan.</p>
      ) : (
        <div className="flex flex-col md:flex-row gap-2">
          <AdminInput
            value={url}
            readOnly
            className="py-2 text-sm bg-white/5 truncate"
          />

          <div className="flex gap-2">
            <AdminButton
              size="sm"
              onClick={copyLink}
              saved={copied}
              savedLabel="Copiat!"
              className="flex-1"
            >
              Copiază
            </AdminButton>

            <AdminButton
              variant="secondary"
              size="sm"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1"
              onClick={markShared}
            >
              Deschide
            </AdminButton>
          </div>
        </div>
      )}
    </AdminCard>
  );
}
