"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { buildMobileMainItems, buildMobileMoreItems } from "./adminNav";

export default function MobileNav({
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
  const [open, setOpen] = useState(false);

  const mainItems = buildMobileMainItems({ role, actsAsBarber });
  const moreItems = buildMobileMoreItems({
    role,
    actsAsBarber,
    assistantEnabled,
    platformAssistantEnabled,
    frizeoEmailEnabled,
  });

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className={`fixed left-0 right-0 bottom-0 bg-white border-t border-frz-line rounded-t-3xl z-[60] md:hidden transition-transform duration-300 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="p-6">
          <div className="w-12 h-1 bg-frz-line/80 rounded-full mx-auto mb-6" />

          <h3 className="text-center text-lg font-semibold mb-6">Mai mult</h3>

          <div className="space-y-3">
            {moreItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-frz-fog"
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}

            <form action="/api/auth/logout" method="post">
              <button className="w-full flex items-center gap-3 p-3 rounded-xl text-red-600 hover:bg-frz-fog">
                <span>🚪</span>
                <span>Logout</span>
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-frz-line flex justify-around py-2 md:hidden z-50">
        {mainItems.map((item) => {
          const active = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={`text-xl transition ${
                active ? "text-frz-ink" : "text-frz-ink/40"
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
          className="text-xl text-frz-ink/70"
        >
          ☰
        </button>
      </div>
    </>
  );
}
