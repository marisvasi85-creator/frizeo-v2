"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type GalleryImage = {
  id: string;
  image_url: string;
  created_at?: string;
};

export default function GalleryUpload({
  images: initialImages,
}: {
  images: GalleryImage[];
}) {
  const router = useRouter();
  const [images, setImages] = useState(initialImages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/salon/gallery", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload eșuat");
      }

      if (data.id && data.url) {
        setImages((prev) => [
          ...prev,
          {
            id: data.id,
            image_url: data.url,
            created_at: data.created_at,
          },
        ]);
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload eșuat");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  async function removeImage(id: string) {
    if (!confirm("Ștergi această fotografie?")) {
      return;
    }

    setError("");
    const previous = images;
    setImages((prev) => prev.filter((img) => img.id !== id));

    try {
      const res = await fetch(`/api/salon/gallery/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        setImages(previous);
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Ștergere eșuată");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ștergere eșuată");
    }
  }

  return (
    <div className="bg-[#161618] border border-white/10 rounded-xl p-6 space-y-4">
      <h2 className="text-lg font-semibold">Galerie salon</h2>

      <input type="file" accept="image/*" onChange={upload} />

      {loading && <p>Se încarcă...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {images.map((img) => (
          <div key={img.id} className="relative">
            <img
              src={img.image_url}
              alt=""
              className="w-full h-32 object-cover rounded-xl"
            />

            <button
              type="button"
              onClick={() => removeImage(img.id)}
              className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 rounded text-xs"
            >
              Șterge
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
