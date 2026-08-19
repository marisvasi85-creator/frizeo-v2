"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const OPTIONS = [
  { value: "system", label: "System", icon: "🖥️" },
  { value: "light", label: "Light", icon: "☀️" },
  { value: "dark", label: "Dark", icon: "🌙" },
] as const;

export default function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex gap-1 rounded-xl bg-frz-fog p-1">
        {OPTIONS.map((opt) => (
          <div
            key={opt.value}
            className="flex-1 rounded-lg px-3 py-2 text-center text-sm text-frz-muted"
          >
            <span className="mr-1.5">{opt.icon}</span>
            {opt.label}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-1 rounded-xl bg-frz-fog p-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setTheme(opt.value)}
          className={`flex-1 rounded-lg px-3 py-2 text-center text-sm transition ${
            theme === opt.value
              ? "bg-frz-card text-frz-ink font-medium shadow-frz"
              : "text-frz-muted hover:text-frz-ink"
          }`}
        >
          <span className="mr-1.5">{opt.icon}</span>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
