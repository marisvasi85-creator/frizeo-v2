"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "@/styles/theme.css";
import "@/styles/dashboard.css";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="dashboard">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <h2 className="logo">Frizeo</h2>

        <nav>
          <Link
            href="/admin/dashboard/barber"
            className={pathname === "/admin/dashboard/barber" ? "active" : ""}
          >
            🧑‍✂️ Dashboard
          </Link>

          <Link
            href="/admin/dashboard/barber/bookings"
            className={pathname.includes("/bookings") ? "active" : ""}
          >
            📅 Programări
          </Link>

          <Link
            href="/admin/dashboard/barber/settings"
            className={pathname.includes("/settings") ? "active" : ""}
          >
            ⚙️ Setări program
          </Link>

          <Link
            href="/admin/dashboard/barber/overrides"
            className={pathname.includes("/overrides") ? "active" : ""}
          >
            🚫 Zile libere
          </Link>
        </nav>
      </aside>

      {/* CONTENT */}
      <main className="content">{children}</main>
    </div>
  );
}
