"use client";

import { useEffect } from "react";
import {
  isAllowedPwaStartPath,
  type PwaManifestVariant,
} from "@/lib/pwa/manifestContent";

type UsePwaManifestOptions = {
  startPath: string | null;
  variant: PwaManifestVariant;
  label?: string | null;
};

export function usePwaManifest({
  startPath,
  variant,
  label,
}: UsePwaManifestOptions) {
  useEffect(() => {
    if (!startPath || !isAllowedPwaStartPath(startPath)) {
      return;
    }

    const params = new URLSearchParams({
      start: startPath,
      variant,
    });

    if (label?.trim()) {
      params.set("label", label.trim());
    }

    const href = `/api/pwa/manifest?${params.toString()}`;
    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');

    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }

    link.href = href;
  }, [startPath, variant, label]);
}
