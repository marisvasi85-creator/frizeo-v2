"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buildAdminNavItems } from "./adminNav";

export default function Sidebar({
  role,
  actsAsBarber = true,
  assistantEnabled = false,
  platformAssistantEnabled = false,
  frizeoEmailEnabled = false,
}: {
  role: string | null;
  actsAsBarber?: boolean;
  assistantEnabled?: boolean;
  platformAssistantEnabled?: boolean;
  frizeoEmailEnabled?: boolean;
}) {
  const pathname = usePathname();
  const navItems = buildAdminNavItems({
    role,
    actsAsBarber,
    assistantEnabled,
    platformAssistantEnabled,
    frizeoEmailEnabled,
  });

  return (
    <aside className="hidden md:flex w-64 border-r border-frz-line p-6 flex-col justify-between bg-frz-card">
      <div>
        <h2 className="text-xl font-semibold mb-8 tracking-wide text-frz-ink">
          Frizeo
        </h2>

        <nav className="flex flex-col gap-2">
          {navItems.map((item) => {
            const isExternalHandoff = item.href.startsWith("/api/");
            const active =
              !isExternalHandoff && pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition
                  ${
                    active
                      ? "bg-frz-ink text-frz-ink-contrast"
                      : "text-frz-ink/70 hover:bg-frz-fog hover:text-frz-ink"
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
            className="block text-center bg-frz-fog text-frz-ink py-2 rounded-lg text-sm font-medium hover:bg-frz-mist transition"
          >
            Abonament
          </Link>
        )}

        <form action="/api/auth/logout" method="post">
          <button className="w-full text-sm text-red-600 hover:text-red-500">
            🚪 Logout
          </button>
        </form>
      </div>
    </aside>
  );
}
