"use client";

import { useEffect, useState } from "react";
import type { BeforeInstallPromptEvent } from "@/lib/pwa/beforeInstallPrompt";
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

export default function AddToHomeScreenPrompt() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>("unsupported");
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isStandaloneMode() || isInstallPromptSnoozed() || !isMobileDevice()) {
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
  }, []);

  function dismiss() {
    snoozeInstallPrompt();
    setVisible(false);
  }

  async function install() {
    if (!deferredPrompt) return;

    setInstalling(true);

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === "accepted") {
        snoozeInstallPrompt();
        setVisible(false);
      }
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
    }
  }

  if (!visible) return null;

  const title = "Adaugă Frizeo pe ecranul Acasă";
  const subtitle =
    platform === "ios"
      ? "Accesezi panoul mai rapid, ca o aplicație."
      : "Deschizi panoul direct, fără să cauți site-ul în browser.";

  return (
    <div
      role="dialog"
      aria-label={title}
      className="fixed left-0 right-0 z-[90] p-4 md:hidden"
      style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-[#161618] p-5 shadow-2xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0B0B0C] text-lg font-semibold text-white">
            F
          </div>

          <div className="min-w-0">
            <h2 className="text-base font-semibold text-white">{title}</h2>
            <p className="mt-1 text-sm text-white/70">{subtitle}</p>
          </div>
        </div>

        {platform === "ios" && (
          <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm text-white/80">
            <li>Apasă butonul Partajare din Safari (pătrat cu săgeată în sus).</li>
            <li>
              Alege{" "}
              <strong className="text-white">
                Adaugă pe ecranul de pornire
              </strong>
              .
            </li>
            <li>Confirmă cu Adaugă.</li>
          </ol>
        )}

        {platform === "android-manual" && (
          <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm text-white/80">
            <li>Apasă meniul Chrome (⋮) din colțul din dreapta sus.</li>
            <li>
              Alege{" "}
              <strong className="text-white">
                Adaugă la ecranul de pornire
              </strong>{" "}
              sau <strong className="text-white">Instalează aplicația</strong>.
            </li>
            <li>Confirmă instalarea.</li>
          </ol>
        )}

        {platform === "android-installable" && (
          <p className="mb-4 text-sm text-white/80">
            Un singur tap și ai pictograma Frizeo alături de celelalte aplicații.
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="flex-1 rounded-xl bg-white/10 px-4 py-2.5 text-sm text-white hover:bg-white/15"
          >
            Nu acum
          </button>

          {platform === "android-installable" && (
            <button
              type="button"
              onClick={() => void install()}
              disabled={installing || !deferredPrompt}
              className="flex-1 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black disabled:opacity-60"
            >
              {installing ? "Se adaugă..." : "Adaugă"}
            </button>
          )}

          {platform !== "android-installable" && (
            <button
              type="button"
              onClick={dismiss}
              className="flex-1 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black"
            >
              Am înțeles
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
