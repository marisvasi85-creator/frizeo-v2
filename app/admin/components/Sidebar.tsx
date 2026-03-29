"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/admin/calendar", label: "Calendar", icon: "📅" },
  { href: "/admin/bookings", label: "Programări", icon: "📋" },
  { href: "/admin/services", label: "Servicii", icon: "✂️" },
  { href: "/admin/settings", label: "Setări", icon: "⚙️" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 border-r border-white/10 p-6 flex-col justify-between">
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

      <form action="/api/auth/logout" method="post">
        <button className="text-sm text-red-400 hover:text-red-300">
          Logout
        </button>
      </form>
    </aside>
  );
}