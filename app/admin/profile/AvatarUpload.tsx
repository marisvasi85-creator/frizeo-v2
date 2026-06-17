"use client";

import { useState } from "react";

export default function AvatarUpload({
  currentUrl,
}: {
  currentUrl?: string | null;
}) {
  const [loading, setLoading] =
    useState(false);

  const [preview, setPreview] =
    useState(currentUrl || "");

  async function upload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      e.target.files?.[0];

    if (!file) return;

    setLoading(true);

    const formData =
      new FormData();

    formData.append("file", file);

    const res = await fetch(
      "/api/barber/avatar",
      {
        method: "POST",
        body: formData,
      }
    );

    const data =
      await res.json();

    if (data.url) {
      setPreview(data.url);
    }

    setLoading(false);
  }

  return (
    <div className="bg-[#161618] border border-white/10 rounded-xl p-6 space-y-4">
      <h2 className="text-lg font-semibold">
        Poză profil
      </h2>

      {preview ? (
        <img
          src={preview}
          alt=""
          className="w-32 h-32 rounded-full object-cover border border-white/10"
        />
      ) : (
        <div className="w-32 h-32 rounded-full bg-[#0F0F10] border border-white/10 flex items-center justify-center text-white/40">
          Fără poză
        </div>
      )}

      <input
        type="file"
        accept="image/*"
        onChange={upload}
      />

      {loading && (
        <p className="text-sm text-white/60">
          Se încarcă...
        </p>
      )}
    </div>
  );
}