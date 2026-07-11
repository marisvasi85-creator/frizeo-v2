"use client";

import { useEffect, useState } from "react";
import type { BeforeInstallPromptEvent } from "@/lib/pwa/beforeInstallPrompt";
import type { PwaManifestVariant } from "@/lib/pwa/manifestContent";
import {
  detectInstallPlatform,
  isInstallPromptSnoozed,
  isMobileDevice,
  isStandaloneMode,
  snoozeInstallPrompt,
  type InstallPlatform,
} from "@/lib/pwa/installPrompt";

const SHOW_DELAY_MS = 3000;
const ANDROID_PROMPT_WAIT_MS = 2000;

const COPY: Record<
  PwaManifestVariant,
  { title: string; subtitle: string; androidInstallable: string }
> = {
  admin: {
    title: "Adaugă Frizeo pe ecranul Acasă",
    subtitle: "Accesezi panoul mai rapid, ca o aplicație.",
    androidInstallable:
      "Un singur tap și ai pictograma Frizeo alături de celelalte aplicații.",
  },
  booking: {
    title: "Salvează programările pe ecranul Acasă",
    subtitle: "Revii rapid la frizer, fără să cauți din nou linkul primit.",
    androidInstallable:
      "Un singur tap și ai linkul frizerului mereu la îndemână.",
  },
};

type AddToHomeScreenPromptProps = {
  variant: PwaManifestVariant;
  snoozeScope: string;
};

export default function AddToHomeScreenPrompt({
  variant,
  snoozeScope,
}: AddToHomeScreenPromptProps) {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>("unsupported");
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  const copy = COPY[variant];
  const isBooking = variant === "booking";

  useEffect(() => {
    if (
      isStandaloneMode() ||
      isInstallPromptSnoozed(snoozeScope) ||
      !isMobileDevice()
    ) {
      return;
    }

    const detected = detectInstallPlatform();
    if (detected === "unsupported") {
      return;
    }

    let cancelled = false;
    let showTimer: ReturnType<typeof setTimeout> | null = null;
    let receivedPrompt = false;

    const show = (nextPlatform: InstallPlatform) => {
      if (cancelled) return;
      setPlatform(nextPlatform);
      setVisible(true);
    };

    const onBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      receivedPrompt = true;
      if (showTimer) clearTimeout(showTimer);
      setDeferredPrompt(event);
      showTimer = setTimeout(
        () => show("android-installable"),
        SHOW_DELAY_MS
      );
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    if (detected === "ios") {
      showTimer = setTimeout(() => show("ios"), SHOW_DELAY_MS);
    } else if (detected === "android-manual") {
      showTimer = setTimeout(() => {
        if (!receivedPrompt) {
          show("android-manual");
        }
      }, SHOW_DELAY_MS + ANDROID_PROMPT_WAIT_MS);
    }

    return () => {
      cancelled = true;
      if (showTimer) clearTimeout(showTimer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, [snoozeScope]);

  function dismiss() {
    snoozeInstallPrompt(snoozeScope);
    setVisible(false);
  }

  async function install() {
    if (!deferredPrompt) return;

    setInstalling(true);

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === "accepted") {
        snoozeInstallPrompt(snoozeScope);
        setVisible(false);
      }
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
    }
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label={copy.title}
      className="fixed left-0 right-0 z-[90] p-4 md:hidden"
      style={{
        bottom: isBooking
          ? "calc(1rem + env(safe-area-inset-bottom, 0px))"
          : "calc(4.5rem + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div
        className={`mx-auto max-w-lg rounded-2xl border p-5 shadow-2xl ${
          isBooking
            ? "border-black/10 bg-white text-[#0B0B0C]"
            : "border-white/10 bg-[#161618] text-white"
        }`}
      >
        <div className="mb-4 flex items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-semibold ${
              isBooking
                ? "bg-[#0B0B0C] text-white"
                : "bg-[#0B0B0C] text-white"
            }`}
          >
            F
          </div>

          <div className="min-w-0">
            <h2 className="text-base font-semibold">{copy.title}</h2>
            <p
              className={`mt-1 text-sm ${
                isBooking ? "text-black/65" : "text-white/70"
              }`}
            >
              {copy.subtitle}
            </p>
          </div>
        </div>

        {platform === "ios" && (
          <ol
            className={`mb-4 list-decimal space-y-2 pl-5 text-sm ${
              isBooking ? "text-black/75" : "text-white/80"
            }`}
          >
            <li>Apasă butonul Partajare din Safari (pătrat cu săgeată în sus).</li>
            <li>
              Alege{" "}
              <strong className={isBooking ? "text-black" : "text-white"}>
                Adaugă pe ecranul de pornire
              </strong>
              .
            </li>
            <li>Confirmă cu Adaugă.</li>
          </ol>
        )}

        {platform === "android-manual" && (
          <ol
            className={`mb-4 list-decimal space-y-2 pl-5 text-sm ${
              isBooking ? "text-black/75" : "text-white/80"
            }`}
          >
            <li>Apasă meniul Chrome (⋮) din colțul din dreapta sus.</li>
            <li>
              Alege{" "}
              <strong className={isBooking ? "text-black" : "text-white"}>
                Adaugă la ecranul de pornire
              </strong>{" "}
              sau{" "}
              <strong className={isBooking ? "text-black" : "text-white"}>
                Instalează aplicația
              </strong>
              .
            </li>
            <li>Confirmă instalarea.</li>
          </ol>
        )}

        {platform === "android-installable" && (
          <p
            className={`mb-4 text-sm ${
              isBooking ? "text-black/75" : "text-white/80"
            }`}
          >
            {copy.androidInstallable}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={dismiss}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm ${
              isBooking
                ? "bg-black/5 text-black hover:bg-black/10"
                : "bg-white/10 text-white hover:bg-white/15"
            }`}
          >
            Nu acum
          </button>

          {platform === "android-installable" && (
            <button
              type="button"
              onClick={() => void install()}
              disabled={installing || !deferredPrompt}
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-60 ${
                isBooking
                  ? "bg-[#0B0B0C] text-white"
                  : "bg-white text-black"
              }`}
            >
              {installing ? "Se adaugă..." : "Adaugă"}
            </button>
          )}

          {platform !== "android-installable" && (
            <button
              type="button"
              onClick={dismiss}
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium ${
                isBooking
                  ? "bg-[#0B0B0C] text-white"
                  : "bg-white text-black"
              }`}
            >
              Am înțeles
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
