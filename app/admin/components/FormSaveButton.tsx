"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import AdminButton from "./AdminButton";

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

      <AdminButton
        type="submit"
        loading={pending}
        loadingLabel="Se salvează..."
        className="px-5 py-3"
      >
        {label}
      </AdminButton>
    </div>
  );
}
