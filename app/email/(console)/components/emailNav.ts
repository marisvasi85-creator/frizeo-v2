import { isEmailHost } from "@/lib/frizeo-email/config";

export type EmailNavItem = {
  /** Path under the email app, e.g. "" for dashboard, "/contacts". */
  path: string;
  label: string;
  icon: string;
  ownerOnly?: boolean;
};

export const EMAIL_NAV_ITEMS: EmailNavItem[] = [
  { path: "", label: "Dashboard", icon: "📊" },
  {
    path: "/analytics",
    label: "Trafic & conversii",
    icon: "📈",
    ownerOnly: true,
  },
  { path: "/contacts", label: "Contacts", icon: "👤" },
  { path: "/segments", label: "Segments", icon: "🗂️" },
  { path: "/campaigns", label: "Campaigns", icon: "📨" },
  { path: "/automations", label: "Automations", icon: "⚡" },
  { path: "/settings", label: "Settings", icon: "⚙️" },
];

/** Internal Next.js route prefix (filesystem). */
export const EMAIL_APP_PREFIX = "/email";

/**
 * True on the dedicated email host (email.frizeo.ro), where public URLs are
 * bare (`/contacts`). On www / localhost the app lives under `/email`.
 */
export function shouldUseBareEmailPaths(host?: string | null): boolean {
  if (host != null && host !== "") {
    return isEmailHost(host);
  }
  if (typeof window !== "undefined") {
    return isEmailHost(window.location.hostname);
  }
  return false;
}

/**
 * Build an in-app href for Frizeo Email console pages.
 * Pass `bare` or `host` from the server when SSR-ing Links so email.frizeo.ro
 * does not emit `/email/...` (client navigations skip the 308 rewrite).
 */
export function emailHref(
  path: string,
  opts?: { bare?: boolean; host?: string | null },
): string {
  const raw = path.trim();
  const qIndex = raw.indexOf("?");
  const pathnamePart = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
  const query = qIndex >= 0 ? raw.slice(qIndex + 1) : "";

  const normalized =
    pathnamePart === "" || pathnamePart === "/"
      ? ""
      : pathnamePart.startsWith("/")
        ? pathnamePart
        : `/${pathnamePart}`;

  const bare = opts?.bare ?? shouldUseBareEmailPaths(opts?.host ?? null);
  const href = bare
    ? normalized || "/"
    : `${EMAIL_APP_PREFIX}${normalized}` || EMAIL_APP_PREFIX;

  return query ? `${href}?${query}` : href;
}

export function isEmailNavActive(pathname: string, path: string): boolean {
  const candidates = [
    emailHref(path, { bare: false }),
    emailHref(path, { bare: true }),
  ];
  if (path === "" || path === "/") {
    return (
      pathname === "/email" ||
      pathname === "/email/" ||
      pathname === "/" ||
      pathname === ""
    );
  }
  return candidates.some(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  );
}
