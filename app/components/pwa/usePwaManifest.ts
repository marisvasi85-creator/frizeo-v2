"use client";

import { useEffect } from "react";
import {
  isAllowedPwaStartPath,
  pwaIconHref,
  type PwaManifestVariant,
} from "@/lib/pwa/manifestContent";

type UsePwaManifestOptions = {
  startPath: string | null;
  variant: PwaManifestVariant;
  label?: string | null;
  logo?: string | null;
};

function upsertLink(
  rel: string,
  href: string,
  attrs: Record<string, string> = {},
) {
  let link = document.querySelector<HTMLLinkElement>(
    `link[rel="${rel}"]${attrs.sizes ? `[sizes="${attrs.sizes}"]` : ""}`,
  );

  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    for (const [key, value] of Object.entries(attrs)) {
      link.setAttribute(key, value);
    }
    document.head.appendChild(link);
  }

  link.href = href;
}

export function usePwaManifest({
  startPath,
  variant,
  label,
  logo,
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
    if (logo?.trim()) {
      params.set("logo", logo.trim());
    }

    const href = `/api/pwa/manifest?${params.toString()}`;
    upsertLink("manifest", href);

    if (variant === "booking" && (label?.trim() || logo?.trim())) {
      upsertLink(
        "apple-touch-icon",
        pwaIconHref({
          size: 180,
          label,
          logo,
        }),
      );
    } else if (variant === "admin") {
      // Keep Frizeo mark — do not inherit a salon apple-touch-icon from prior navigation.
      upsertLink("apple-touch-icon", "/apple-icon");
    }
  }, [startPath, variant, label, logo]);
}
