"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { EMAIL_NAV_ITEMS, emailHref, isEmailNavActive } from "./emailNav";

export default function EmailMobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const mainItems = EMAIL_NAV_ITEMS.slice(0, 4);
  const moreItems = EMAIL_NAV_ITEMS.slice(4);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-frz-overlay z-50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className={`fixed left-0 right-0 bottom-0 bg-frz-card border-t border-frz-line rounded-t-3xl z-[60] md:hidden transition-transform duration-300 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="p-6">
          <div className="w-12 h-1 bg-frz-line/80 rounded-full mx-auto mb-6" />

          <h3 className="text-center text-lg font-semibold mb-6">Mai mult</h3>

          <div className="space-y-3">
            {moreItems.map((item) => (
              <Link
                key={item.path}
                href={emailHref(item.path)}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-frz-fog"
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-frz-line bg-frz-card">
        <ul className="flex justify-around px-2 py-2">
          {mainItems.map((item) => {
            const active = isEmailNavActive(pathname, item.path);
            return (
              <li key={item.path || "dashboard"}>
                <Link
                  href={emailHref(item.path)}
                  className={`flex flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[11px] ${
                    active ? "text-frz-ink" : "text-frz-ink/40"
                  }`}
                >
                  <span className="text-base" aria-hidden>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Mai mult"
              className="flex flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[11px] text-frz-ink/70"
            >
              <span className="text-base" aria-hidden>
                ☰
              </span>
              Mai mult
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
