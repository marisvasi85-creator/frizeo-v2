"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

const AssistantChatPanel = dynamic(
  () => import("@/app/admin/components/AssistantChatPanel"),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center text-sm text-neutral-500 p-6">
        Se încarcă…
      </div>
    ),
  },
);

const SUGGESTIONS = [
  "Ce servicii aveți?",
  "Ce ore sunt libere mâine?",
  "Care e telefonul?",
  "Cine sunt frizerii?",
];

type FloatingPublicBookingAssistantProps = {
  configured: boolean;
  salonSlug: string;
  salonName: string;
  /** When set (e.g. UUID booking page), skip pathname parsing */
  barberSlug?: string | null;
};

function barberSlugFromPath(pathname: string, salonSlug: string): string | null {
  // /booking/salon/{salonSlug}/{barberSlug}
  const prefix = `/booking/salon/${salonSlug}/`;
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length).split("/")[0];
  return rest?.trim() || null;
}

export default function FloatingPublicBookingAssistant({
  configured,
  salonSlug,
  salonName,
  barberSlug: barberSlugProp = null,
}: FloatingPublicBookingAssistantProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  const barberSlug = useMemo(
    () => barberSlugProp || barberSlugFromPath(pathname, salonSlug),
    [barberSlugProp, pathname, salonSlug],
  );

  const requestExtra = useMemo(
    () => ({
      salonSlug,
      ...(barberSlug ? { barberSlug } : {}),
    }),
    [salonSlug, barberSlug],
  );

  const welcomeMessage = useMemo(
    () =>
      `Salut! Sunt asistentul ${salonName}.\n\nTe pot ajuta cu servicii, frizeri, ore libere și telefon. Programarea o finalizezi din formularul de pe pagină.`,
    [salonName],
  );

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

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
          className="fixed inset-0 z-[70] bg-black/30 md:bg-transparent"
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
        <div className="w-[min(100vw-1.5rem,380px)] h-[min(70vh,560px)] flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl shadow-black/15 text-neutral-900">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-neutral-200 bg-neutral-50">
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">
                Asistent {salonName}
              </div>
              <div className="text-[11px] text-neutral-500">
                Programări · întrebări rapide
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-8 w-8 shrink-0 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600"
              aria-label="Închide"
            >
              ✕
            </button>
          </div>

          {hasOpened && (
            <AssistantChatPanel
              configured={configured}
              displayName={salonName}
              compact
              className="flex-1"
              apiPath="/api/public-assistant/chat"
              storageNamespace={`public-booking-${salonSlug}${
                barberSlug ? `-${barberSlug}` : ""
              }`}
              welcomeMessage={welcomeMessage}
              suggestions={SUGGESTIONS}
              requestExtra={requestExtra}
              appearance="light"
            />
          )}
        </div>
      </div>

      {!open && (
        <button
          type="button"
          onClick={openAssistant}
          aria-label="Deschide asistentul de programări"
          className="fixed z-[90] right-3 md:right-6 bottom-20 md:bottom-6 h-14 w-14 rounded-full shadow-lg shadow-black/20 transition flex items-center justify-center text-xl bg-neutral-900 text-white hover:scale-105"
        >
          ?
        </button>
      )}
    </>
  );
}
