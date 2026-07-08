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
    const timer = setTimeout(() => setShowSaved(false), 2500);
    return () => clearTimeout(timer);
  }, [saved]);

  return (
    <div className="flex justify-end">
      <AdminButton
        type="submit"
        loading={pending}
        loadingLabel="Se salvează..."
        saved={showSaved}
        savedLabel={savedLabel}
        className="px-5 py-3"
      >
        {label}
      </AdminButton>
    </div>
  );
}
