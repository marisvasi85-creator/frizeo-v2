"use client";

export default function CopySalonLink({
  url,
}: {
  url: string;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard.writeText(url)
      }
      className="px-4 py-3 bg-white/10 rounded-lg"
    >
      Copiază
    </button>
  );
}