"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ownerItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "🏠" },

  { href: "/admin/bookings", label: "Programări", icon: "📋" },

  { href: "/admin/services", label: "Servicii", icon: "✂️" },

  { href: "/admin/settings", label: "Program de lucru", icon: "🗓️" },

  { href: "/admin/profile", label: "Profil", icon: "👤" },

  { href: "/admin/barbers", label: "Frizeri", icon: "👥" },

  { href: "/admin/salon", label: "Salon", icon: "🏪" },

  { href: "/admin/billing", label: "Abonament", icon: "💎" },
];

const barberItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "🏠" },

  { href: "/admin/bookings", label: "Programări", icon: "📋" },

  { href: "/admin/services", label: "Servicii", icon: "✂️" },

  { href: "/admin/settings", label: "Program de lucru", icon: "🗓️" },

  { href: "/admin/profile", label: "Profil", icon: "👤" },
];


export default function Sidebar({
  role,
}: {
  role: string | null;
}) {
  const pathname = usePathname();
  const navItems =
  role === "owner"
    ? ownerItems
    : barberItems;
  return (
    <aside className="hidden md:flex w-64 border-r border-white/10 p-6 flex-col justify-between">

      {/* TOP */}
      <div>
        <h2 className="text-xl font-semibold mb-8 tracking-wide">
          Frizeo
        </h2>

        <nav className="flex flex-col gap-2">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition
                  ${
                    active
                      ? "bg-white text-black"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* BOTTOM */}
      <div className="space-y-3">

        {/* UPGRADE CTA */}
        {role === "owner" && (
  <Link
    href="/admin/billing/upgrade"
    className="block text-center bg-white text-black py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
  >
    Upgrade plan
  </Link>
)}

        {/* LOGOUT */}
        <form action="/api/auth/logout" method="post">
          <button className="w-full text-sm text-red-400 hover:text-red-300">
            🚪 Logout
          </button>
        </form>

      </div>
    </aside>
  );
}