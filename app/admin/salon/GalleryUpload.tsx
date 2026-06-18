"use client";

import { useState } from "react";

export default function GalleryUpload({
  images,
}: {
  images: any[];
}) {
  const [loading, setLoading] =
    useState(false);

  async function upload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      e.target.files?.[0];

    if (!file) return;

    setLoading(true);

    const formData =
      new FormData();

    formData.append(
      "file",
      file
    );

    await fetch(
      "/api/salon/gallery",
      {
        method: "POST",
        body: formData,
      }
    );

    window.location.reload();
  }

  async function removeImage(
  id: string
) {
  if (
    !confirm(
      "Ștergi această fotografie?"
    )
  ) {
    return;
  }

  await fetch(
    `/api/salon/gallery/${id}`,
    {
      method: "DELETE",
    }
  );

  window.location.reload();
}

  return (
    <div className="bg-[#161618] border border-white/10 rounded-xl p-6 space-y-4">

      <h2 className="text-lg font-semibold">
        Galerie salon
      </h2>

      <input
        type="file"
        accept="image/*"
        onChange={upload}
      />

      {loading && (
        <p>Se încarcă...</p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

        {images.map((img) => (
  <div
    key={img.id}
    className="relative"
  >
    <img
      src={img.image_url}
      alt=""
      className="
        w-full
        h-32
        object-cover
        rounded-xl
      "
    />

    <button
      onClick={() => removeImage(img.id)}
      className="
        absolute
        top-2
        right-2
        bg-red-600
        text-white
        px-2
        py-1
        rounded
        text-xs
      "
    >
      Șterge
    </button>
  </div>
))}
        

      </div>

    </div>
  );
}