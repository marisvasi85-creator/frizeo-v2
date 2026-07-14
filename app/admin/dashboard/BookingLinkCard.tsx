"use client";

import { useEffect, useState } from "react";
import AdminCard from "../components/AdminCard";
import AdminButton from "../components/AdminButton";
import { AdminInput } from "../components/AdminInput";

export default function BookingLinkCard() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/barber/public-link")
      .then((r) => r.json())
      .then((d) => {
        if (!d.url) {
          setError("Link indisponibil momentan.");
          return;
        }
        setUrl(d.url);
      })
      .catch(() => setError("Nu am putut încărca linkul."))
      .finally(() => setLoading(false));
  }, []);

  async function copyLink() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <AdminCard padding="sm" className="mb-6">
      <p className="text-sm text-white/60 mb-2">Linkul tău de programări</p>

      <p className="text-xs text-white/40 mb-3">
        Acest link permanent nu se schimbă când îți actualizezi numele sau
        datele salonului. Îl poți trimite clienților o singură dată.
      </p>

      {loading ? (
        <div className="h-10 bg-white/5 rounded animate-pulse" />
      ) : error ? (
        <p className="text-red-400 text-sm">{error}</p>
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
            >
              Deschide
            </AdminButton>
          </div>
        </div>
      )}
    </AdminCard>
  );
}
