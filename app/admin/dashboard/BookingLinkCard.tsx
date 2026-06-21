"use client";

import { useEffect, useState } from "react";

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
    <div className="bg-[#161618] border border-white/10 rounded-xl p-4 mb-6">
      <p className="text-sm text-white/60 mb-2">Linkul tău de programări</p>

      <p className="text-xs text-white/40 mb-3">
        Trimite acest link clienților pentru programări online.
      </p>

      {loading ? (
        <div className="h-10 bg-white/5 rounded animate-pulse" />
      ) : error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : (
        <div className="flex flex-col md:flex-row gap-2">
          <input
            value={url}
            readOnly
            className="w-full min-w-0 border border-white/10 px-3 py-2 rounded text-sm text-white bg-white/5 truncate"
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="flex-1 px-3 py-2 bg-white text-black rounded text-sm font-medium"
            >
              {copied ? "Copiat!" : "Copiază"}
            </button>

            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-3 py-2 bg-white/10 text-white rounded text-sm text-center hover:bg-white/20"
            >
              Deschide
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
