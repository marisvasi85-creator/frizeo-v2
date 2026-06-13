"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ownerItems = [
  { href: "/admin/dashboard", icon: "🏠" },

  { href: "/admin/bookings", icon: "📋" },

  { href: "/admin/barbers", icon: "👥" },

  { href: "/admin/settings", icon: "⚙️" },

  { href: "/admin/billing", icon: "💎" },
];

const barberItems = [
  { href: "/admin/dashboard", icon: "🏠" },

  { href: "/admin/bookings", icon: "📋" },

  { href: "/admin/services", icon: "✂️" },

  { href: "/admin/settings", icon: "🗓️" },
  
  { href: "/admin/profile", icon: "👤" },
];

export default function MobileNav({
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
    <div className="fixed bottom-0 left-0 right-0 bg-[#0B0B0C] border-t border-white/10 flex justify-around py-2 md:hidden z-50">
      {navItems.map((item) => {
        const active = pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`text-xl transition ${
              active ? "text-white" : "text-white/40"
            }`}
          >
            {item.icon}
          </Link>
        );
      })}
    </div>
  );
}