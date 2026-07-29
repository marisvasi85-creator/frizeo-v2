"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buildAdminNavItems } from "./adminNav";

export default function Sidebar({
  role,
  actsAsBarber = true,
  assistantEnabled = false,
  platformAssistantEnabled = false,
}: {
  role: string | null;
  actsAsBarber?: boolean;
  assistantEnabled?: boolean;
  platformAssistantEnabled?: boolean;
}) {
  const pathname = usePathname();
  const navItems = buildAdminNavItems({
    role,
    actsAsBarber,
    assistantEnabled,
    platformAssistantEnabled,
  });

  return (
    <aside className="hidden md:flex w-64 border-r border-white/10 p-6 flex-col justify-between">
      <div>
        <h2 className="text-xl font-semibold mb-8 tracking-wide">Frizeo</h2>

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

      <div className="space-y-3">
        {role === "owner" && (
          <Link
            href="/admin/billing"
            className="block text-center bg-white text-black py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
          >
            Abonament
          </Link>
        )}

        <form action="/api/auth/logout" method="post">
          <button className="w-full text-sm text-red-400 hover:text-red-300">
            🚪 Logout
          </button>
        </form>
      </div>
    </aside>
  );
}
