"use client";

export default function CopyBookingLink({
  url,
}: {
  url: string;
}) {
  async function copyLink() {
    await navigator.clipboard.writeText(url);

    alert("Link copiat");
  }

  return (
    <button
      onClick={copyLink}
      className="
        mt-3
        px-4
        py-2
        bg-white
        text-black
        rounded-lg
        text-sm
        font-medium
      "
    >
      Copiază link
    </button>
  );
}