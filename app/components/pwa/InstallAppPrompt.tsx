"use client";

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

  usePwaManifest({
    startPath: enabled ? startPath : null,
    variant,
    label,
  });

  if (!enabled) {
    return null;
  }

  return (
    <>
      <RegisterServiceWorker />
      <AddToHomeScreenPrompt variant={variant} snoozeScope={snoozeScope} />
    </>
  );
}
