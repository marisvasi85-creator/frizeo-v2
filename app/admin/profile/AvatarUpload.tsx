"use client";

import { useEffect, useRef, useState } from "react";
import ImageFilePicker from "../components/ImageFilePicker";

export default function AvatarUpload({
  currentUrl,
}: {
  currentUrl?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(currentUrl || "");
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  function setPreviewUrl(url: string, isObject = false) {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    if (isObject) {
      objectUrlRef.current = url;
    }

    setPreview(url);
  }

  async function upload(file: File) {
    setPreviewUrl(URL.createObjectURL(file), true);
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/barber/avatar", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (data.url) {
      setPreviewUrl(data.url);
    }

    setLoading(false);
  }

  return (
    <div className="bg-[#161618] border border-white/10 rounded-xl p-6 space-y-4">
      <h2 className="text-lg font-semibold">Poză profil</h2>

      {preview ? (
        <img
          src={preview}
          alt=""
          className="w-32 h-32 rounded-full object-cover border border-white/10"
        />
      ) : (
        <div className="w-32 h-32 rounded-full bg-[#0F0F10] border border-white/10 flex items-center justify-center text-white/40 text-sm text-center px-2">
          Fără poză
        </div>
      )}

      <ImageFilePicker
        onSelect={upload}
        loading={loading}
        label="Alege poză"
        changeLabel="Schimbă poză"
      />
    </div>
  );
}
