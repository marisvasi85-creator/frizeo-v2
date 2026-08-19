"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const AssistantChatPanel = dynamic(() => import("./AssistantChatPanel"), {
  ssr: false,
  loading: () => (
      <div className="flex-1 flex items-center justify-center text-sm text-frz-ink/50 p-6">
        Se încarcă Assistant…
      </div>
  ),
});

type FloatingAssistantProps = {
  configured: boolean;
  displayName: string;
};

export default function FloatingAssistant({
  configured,
  displayName,
}: FloatingAssistantProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  // Hide salon FAB on full-page assistants so it doesn't cover Trimite.
  // /admin/platform-assistant is creator-only, so this path only affects the creator.
  const hideOnPage =
    pathname.startsWith("/admin/assistant") ||
    pathname.startsWith("/admin/platform-assistant");

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (hideOnPage) return null;

  function openAssistant() {
    setHasOpened(true);
    setOpen(true);
  }

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Închide chat"
          className="fixed inset-0 z-[70] bg-black/40 md:bg-transparent"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className={`fixed z-[80] right-3 md:right-6 bottom-20 md:bottom-6 transition-all duration-200 ${
          open
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-3 pointer-events-none"
        }`}
      >
        <div className="w-[min(100vw-1.5rem,380px)] h-[min(70vh,560px)] flex flex-col overflow-hidden rounded-2xl border border-frz-line bg-white shadow-frz">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-frz-line bg-frz-fog">
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">
                Frizeo Assistant
              </div>
              <div className="text-[11px] text-frz-ink/50">
                Chat helper · staging
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-8 w-8 shrink-0 rounded-full bg-white border border-frz-line hover:bg-frz-fog text-frz-ink/70"
              aria-label="Închide"
            >
              ✕
            </button>
          </div>

          {/* Load chat JS only after the FAB is opened at least once. */}
          {hasOpened && (
            <AssistantChatPanel
              configured={configured}
              displayName={displayName}
              compact
              className="flex-1"
            />
          )}
        </div>
      </div>

      {!open && (
        <button
          type="button"
          onClick={openAssistant}
          aria-label="Deschide Frizeo Assistant"
          className="fixed z-[90] right-3 md:right-6 bottom-20 md:bottom-6 h-14 w-14 rounded-full shadow-lg shadow-black/40 transition flex items-center justify-center text-2xl bg-white text-black hover:scale-105"
        >
          🤖
        </button>
      )}
    </>
  );
}
