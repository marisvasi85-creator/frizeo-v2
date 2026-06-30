"use client";

import { clearConsentChoice } from "@/lib/analytics/consent";

type Props = {
  className?: string;
  label?: string;
};

export default function CookiePreferencesButton({
  className = "hover:text-black underline-offset-2 hover:underline",
  label = "Preferințe cookies",
}: Props) {
  function resetPreferences() {
    clearConsentChoice();
    window.location.reload();
  }

  return (
    <button type="button" onClick={resetPreferences} className={className}>
      {label}
    </button>
  );
}
