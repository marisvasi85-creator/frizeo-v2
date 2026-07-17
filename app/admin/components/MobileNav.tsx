"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const ownerMainItems = [
  { href: "/admin/dashboard", icon: "🏠", label: "Dashboard" },
  { href: "/admin/bookings", icon: "📋", label: "Programări" },
  { href: "/admin/services", icon: "✂️", label: "Servicii" },
  { href: "/admin/barbers", icon: "👥", label: "Frizeri" },
];

const barberMainItems = [
  { href: "/admin/dashboard", icon: "🏠", label: "Dashboard" },
  { href: "/admin/bookings", icon: "📋", label: "Programări" },
  { href: "/admin/services", icon: "✂️", label: "Servicii" },
  { href: "/admin/marketing-ai", icon: "✨", label: "Marketing AI" },
];

const ownerMoreItems = [
  {
    href: "/admin/notifications",
    icon: "🔔",
    label: "Notificări",
  },
  {
    href: "/admin/profile",
    icon: "👤",
    label: "Profil",
  },
  {
    href: "/admin/settings",
    icon: "🗓️",
    label: "Program de lucru",
  },
  {
    href: "/admin/salon",
    icon: "🏪",
    label: "Salon",
  },
  {
    href: "/admin/marketing-ai",
    icon: "✨",
    label: "Marketing AI",
  },
  {
    href: "/admin/assistant",
    icon: "🤖",
    label: "Assistant",
  },
  {
    href: "/admin/billing",
    icon: "💎",
    label: "Abonament",
  },
];

const barberMoreItems = [
  {
    href: "/admin/notifications",
    icon: "🔔",
    label: "Notificări",
  },
  {
    href: "/admin/profile",
    icon: "👤",
    label: "Profil",
  },
  {
    href: "/admin/settings",
    icon: "🗓️",
    label: "Program de lucru",
  },
  {
    href: "/admin/assistant",
    icon: "🤖",
    label: "Assistant",
  },
];

export default function MobileNav({
  role,
  assistantEnabled = false,
}: {
  role: string | null;
  assistantEnabled?: boolean;
}) {
  const pathname = usePathname();

  const [open, setOpen] =
    useState(false);

  const mainItems =
    role === "owner"
      ? ownerMainItems
      : barberMainItems;

  const moreItems = (
    role === "owner" ? ownerMoreItems : barberMoreItems
  ).filter((item) => assistantEnabled || item.href !== "/admin/assistant");

  return (
    <>
      {/* BACKDROP */}

      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* BOTTOM SHEET */}

      <div
        className={`fixed left-0 right-0 bottom-0 bg-[#161618] border-t border-white/10 rounded-t-3xl z-[60] md:hidden transition-transform duration-300 ${
          open
            ? "translate-y-0"
            : "translate-y-full"
        }`}
      >
        <div className="p-6">

          <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6" />

          <h3 className="text-center text-lg font-semibold mb-6">
            Mai mult
          </h3>

          <div className="space-y-3">

            {moreItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() =>
                  setOpen(false)
                }
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5"
              >
                <span>
                  {item.icon}
                </span>

                <span>
                  {item.label}
                </span>
              </Link>
            ))}

            <form
              action="/api/auth/logout"
              method="post"
            >
              <button className="w-full flex items-center gap-3 p-3 rounded-xl text-red-400 hover:bg-white/5">
                <span>🚪</span>

                <span>Logout</span>
              </button>
            </form>

          </div>

        </div>
      </div>

      {/* NAVIGATION */}

      <div className="fixed bottom-0 left-0 right-0 bg-[#0B0B0C] border-t border-white/10 flex justify-around py-2 md:hidden z-50">

        {mainItems.map((item) => {
          const active =
            pathname.startsWith(
              item.href
            );

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={`text-xl transition ${
                active
                  ? "text-white"
                  : "text-white/40"
              }`}
            >
              {item.icon}
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Mai mult"
          className="text-xl text-white/70"
        >
          ☰
        </button>

      </div>
    </>
  );
}