"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import AddToHomeScreenPrompt from "@/app/components/pwa/AddToHomeScreenPrompt";
import RegisterServiceWorker from "@/app/components/pwa/RegisterServiceWorker";
import { usePwaManifest } from "@/app/components/pwa/usePwaManifest";
import {
  isAllowedPwaStartPath,
  type PwaManifestVariant,
} from "@/lib/pwa/manifestContent";

type InstallAppPromptProps = {
  variant: PwaManifestVariant;
  label?: string | null;
};

function resolveStartPath(
  variant: PwaManifestVariant,
  pathname: string
): string {
  if (variant === "admin") {
    return "/admin/dashboard";
  }

  return pathname;
}

function resolveSnoozeScope(
  variant: PwaManifestVariant,
  pathname: string
): string {
  if (variant === "admin") {
    return "admin";
  }

  return `booking:${pathname}`;
}

export default function InstallAppPrompt({
  variant,
  label,
}: InstallAppPromptProps) {
  const pathname = usePathname();
  const startPath = resolveStartPath(variant, pathname);
  const snoozeScope = resolveSnoozeScope(variant, pathname);
  const enabled =
    variant === "admin" ? true : isAllowedPwaStartPath(pathname);
  const [showPrompt, setShowPrompt] = useState(false);

  usePwaManifest({
    startPath: enabled ? startPath : null,
    variant,
    label,
  });

  useEffect(() => {
    if (!enabled) return;
    // Defer install prompt so it doesn't compete with first paint.
    const id = window.setTimeout(() => setShowPrompt(true), 4000);
    return () => window.clearTimeout(id);
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  return (
    <>
      <RegisterServiceWorker />
      {showPrompt && (
        <AddToHomeScreenPrompt variant={variant} snoozeScope={snoozeScope} />
      )}
    </>
  );
}
