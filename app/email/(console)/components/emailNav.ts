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

export function emailHref(path: string, opts?: { bare?: boolean }): string {
  const normalized = path === "/" ? "" : path;
  if (opts?.bare) return normalized || "/";
  return `${EMAIL_APP_PREFIX}${normalized}` || EMAIL_APP_PREFIX;
}

export function isEmailNavActive(
  pathname: string,
  path: string,
): boolean {
  const candidates = [
    emailHref(path),
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
