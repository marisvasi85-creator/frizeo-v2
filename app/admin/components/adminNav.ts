/** Shared admin navigation — owner admin vs owner+barber vs invited barber. */

export type AdminNavItem = {
  href: string;
  label: string;
  icon: string;
  /** Barber workstation pages (profile, services, schedule). */
  requiresBarber?: boolean;
};

/** Salon management — visible to every owner. */
export const OWNER_ADMIN_ITEMS: AdminNavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/admin/bookings", label: "Programări", icon: "📋" },
  { href: "/admin/reports", label: "Rapoarte", icon: "📊" },
  { href: "/admin/notifications", label: "Notificări", icon: "🔔" },
  { href: "/admin/barbers", label: "Frizeri", icon: "👥" },
  { href: "/admin/salon", label: "Salon", icon: "🏪" },
  { href: "/admin/marketing-ai", label: "Marketing AI", icon: "✨" },
  { href: "/admin/assistant", label: "Assistant", icon: "🤖" },
  { href: "/admin/platform-assistant", label: "Platform AI", icon: "🛠️" },
  { href: "/admin/billing", label: "Abonament", icon: "💎" },
];

/** Personal barber tools — only when the user takes bookings. */
export const BARBER_WORKSTATION_ITEMS: AdminNavItem[] = [
  {
    href: "/admin/services",
    label: "Servicii",
    icon: "✂️",
    requiresBarber: true,
  },
  {
    href: "/admin/settings",
    label: "Program de lucru",
    icon: "🗓️",
    requiresBarber: true,
  },
  {
    href: "/admin/profile",
    label: "Profil frizer",
    icon: "👤",
    requiresBarber: true,
  },
];

/**
 * Invited barber — workstation + own bookings/reports.
 * Notificări / Salon / Billing / Frizeri = doar owner (setări de salon).
 * Marketing AI + Assistant = da (promovare + ajutor programări).
 */
export const INVITED_BARBER_ITEMS: AdminNavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/admin/bookings", label: "Programări", icon: "📋" },
  { href: "/admin/reports", label: "Rapoarte", icon: "📊" },
  ...BARBER_WORKSTATION_ITEMS,
  { href: "/admin/marketing-ai", label: "Marketing AI", icon: "✨" },
  { href: "/admin/assistant", label: "Assistant", icon: "🤖" },
];

export function buildAdminNavItems(options: {
  role: string | null;
  actsAsBarber: boolean;
  assistantEnabled?: boolean;
  platformAssistantEnabled?: boolean;
}): AdminNavItem[] {
  const {
    role,
    actsAsBarber,
    assistantEnabled = false,
    platformAssistantEnabled = false,
  } = options;

  let items: AdminNavItem[];

  if (role === "owner") {
    items = actsAsBarber
      ? interleaveOwnerWithBarberTools()
      : [...OWNER_ADMIN_ITEMS];
  } else {
    items = [...INVITED_BARBER_ITEMS];
  }

  return items.filter((item) => {
    if (item.href === "/admin/assistant") return assistantEnabled;
    if (item.href === "/admin/platform-assistant") {
      return platformAssistantEnabled;
    }
    if (item.requiresBarber && !actsAsBarber) return false;
    return true;
  });
}

/** Owner + barber: admin items, with workstation after Programări. */
function interleaveOwnerWithBarberTools(): AdminNavItem[] {
  const out: AdminNavItem[] = [];
  for (const item of OWNER_ADMIN_ITEMS) {
    out.push(item);
    if (item.href === "/admin/bookings") {
      out.push(...BARBER_WORKSTATION_ITEMS);
    }
  }
  return out;
}

/** Mobile bottom bar (4 slots + more). */
export function buildMobileMainItems(options: {
  role: string | null;
  actsAsBarber: boolean;
}): AdminNavItem[] {
  const { role, actsAsBarber } = options;

  if (role === "owner") {
    if (actsAsBarber) {
      return [
        { href: "/admin/dashboard", label: "Dashboard", icon: "🏠" },
        { href: "/admin/bookings", label: "Programări", icon: "📋" },
        { href: "/admin/services", label: "Servicii", icon: "✂️", requiresBarber: true },
        { href: "/admin/barbers", label: "Frizeri", icon: "👥" },
      ];
    }
    return [
      { href: "/admin/dashboard", label: "Dashboard", icon: "🏠" },
      { href: "/admin/bookings", label: "Programări", icon: "📋" },
      { href: "/admin/barbers", label: "Frizeri", icon: "👥" },
      { href: "/admin/salon", label: "Salon", icon: "🏪" },
    ];
  }

  return [
    { href: "/admin/dashboard", label: "Dashboard", icon: "🏠" },
    { href: "/admin/bookings", label: "Programări", icon: "📋" },
    { href: "/admin/services", label: "Servicii", icon: "✂️", requiresBarber: true },
    { href: "/admin/marketing-ai", label: "Marketing AI", icon: "✨" },
  ];
}

export function buildMobileMoreItems(options: {
  role: string | null;
  actsAsBarber: boolean;
  assistantEnabled?: boolean;
  platformAssistantEnabled?: boolean;
}): AdminNavItem[] {
  const mainHrefs = new Set(
    buildMobileMainItems(options).map((i) => i.href),
  );
  return buildAdminNavItems(options).filter((item) => !mainHrefs.has(item.href));
}

/** True when the signed-in user takes bookings as a barber. */
export function sessionActsAsBarber(session: {
  role: string | null;
  barber: { active?: unknown } | null;
}): boolean {
  if (session.role === "barber") return true;
  return session.barber?.active === true;
}
