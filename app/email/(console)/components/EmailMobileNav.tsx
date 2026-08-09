"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EMAIL_NAV_ITEMS, emailHref, isEmailNavActive } from "./emailNav";

export default function EmailMobileNav() {
  const pathname = usePathname();
  const main = EMAIL_NAV_ITEMS.slice(0, 4);

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-[#0B0B0C]/95 backdrop-blur">
      <ul className="grid grid-cols-4 gap-1 px-2 py-2">
        {main.map((item) => {
          const active = isEmailNavActive(pathname, item.path);
          return (
            <li key={item.path || "dashboard"}>
              <Link
                href={emailHref(item.path)}
                className={`flex flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[11px] ${
                  active ? "text-white" : "text-white/50"
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
      </ul>
    </nav>
  );
}
