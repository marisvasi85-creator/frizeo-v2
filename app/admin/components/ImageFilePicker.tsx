"use client";

import { useRef, useState } from "react";

type Props = {
  onSelect: (file: File) => void;
  loading?: boolean;
  label?: string;
  changeLabel?: string;
  accept?: string;
};

export default function ImageFilePicker({
  onSelect,
  loading = false,
  label = "Alege imagine",
  changeLabel = "Schimbă imagine",
  accept = "image/*",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    onSelect(file);
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="px-4 py-2 bg-white border border-frz-line rounded-lg text-sm text-frz-ink hover:bg-frz-fog disabled:opacity-50"
      >
        {loading ? "Se încarcă..." : fileName ? changeLabel : label}
      </button>

      {fileName && (
        <p className="text-sm text-frz-ink/60 truncate max-w-xs">
          {loading ? fileName : `${fileName} ✔`}
        </p>
      )}
    </div>
  );
}
