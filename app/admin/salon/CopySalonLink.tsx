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
className="
  px-4
  py-3
  bg-frz-fog
  border
  border-frz-line
  rounded-lg
  shrink-0
  text-frz-ink
"    >
      Copiază
    </button>
  );
}