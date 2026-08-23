"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EMAIL_NAV_ITEMS, emailHref, isEmailNavActive } from "./emailNav";

export default function EmailSidebar({
  backUrl,
  showOwnerAnalytics,
}: {
  backUrl: string;
  showOwnerAnalytics: boolean;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 border-r border-frz-line p-6 flex-col justify-between bg-frz-card">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-frz-ink/40 mb-2">
          Internal
        </p>
        <h2 className="text-xl font-semibold mb-8 tracking-wide">
          FRIZEO EMAIL
        </h2>

        <nav className="flex flex-col gap-2">
          {EMAIL_NAV_ITEMS.filter(
            (item) => !item.ownerOnly || showOwnerAnalytics,
          ).map((item) => {
            const href = emailHref(item.path);
            const active = isEmailNavActive(pathname, item.path);
            return (
              <Link
                key={item.path || "dashboard"}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition
                  ${
                    active
                      ? "bg-frz-ink text-frz-ink-contrast"
                      : "text-frz-ink/70 hover:bg-frz-fog hover:text-frz-ink"
                  }`}
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3">
        <a
          href={backUrl}
          className="block text-center border border-frz-line text-frz-ink/80 py-2 rounded-lg text-sm hover:bg-frz-fog transition"
        >
          ← Înapoi la Frizeo
        </a>
      </div>
    </aside>
  );
}
