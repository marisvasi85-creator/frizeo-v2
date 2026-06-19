"use client";

import { useFormStatus } from "react-dom";

export default function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-white text-black px-5 py-3 rounded-lg font-medium disabled:opacity-70"
    >
      {pending ? "Se salvează..." : "Salvează"}
    </button>
  );
}