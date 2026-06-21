"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

type Props = {
  label?: string;
  savedLabel?: string;
  saved?: boolean;
};

export default function FormSaveButton({
  label = "Salvează modificările",
  savedLabel = "Salvat ✔",
  saved = false,
}: Props) {
  const { pending } = useFormStatus();
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;

    setShowSaved(true);
    const timer = setTimeout(() => setShowSaved(false), 3000);
    return () => clearTimeout(timer);
  }, [saved]);

  return (
    <div className="flex justify-end items-center gap-3">
      {showSaved && (
        <span className="text-green-400 text-sm">{savedLabel}</span>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-white text-black px-5 py-3 rounded-lg font-medium disabled:opacity-50"
      >
        {pending ? "Se salvează..." : label}
      </button>
    </div>
  );
}
