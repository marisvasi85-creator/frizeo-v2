"use client";

import { useEffect, useState } from "react";

export default function BookingLinkCard() {
  const [url, setUrl] = useState("");

  useEffect(() => {
    fetch("/api/barber/public-link")
      .then((r) => r.json())
      .then((d) => {
        setUrl(d.url || "");
      });
  }, []);

  return (
    <div className="bg-white border rounded-xl p-4 mb-6">
      <p className="text-sm text-gray-500 mb-2">
        Linkul tău de programări
      </p>

      <p className="text-xs text-gray-400 mt-2">
        Trimite acest link clienților pentru programări online.
      </p>

      <div className="flex flex-col md:flex-row gap-2">

  <input
    value={url}
    readOnly
    className="
      w-full
      min-w-0
      border
      px-3
      py-2
      rounded
      text-sm
      text-black
      bg-gray-50
      truncate
    "
  />

  <div className="flex gap-2">

    <button
      onClick={() => navigator.clipboard.writeText(url)}
      className="flex-1 px-3 py-2 bg-black text-white rounded text-sm"
    >
      Copiază
    </button>

    <a
      href={url}
      target="_blank"
      className="flex-1 px-3 py-2 bg-gray-200 rounded text-sm text-center"
    >
      Deschide
    </a>

  </div>

</div>
    </div>
  );
}