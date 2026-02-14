import Link from "next/link";
import { getActiveTenant } from "@/lib/supabase/getActiveTenant";

export default async function AdminDashboardPage() {
  const tenant = await getActiveTenant();

  // Guard suplimentar (layout-ul deja face redirect,
  // dar păstrăm pagina safe dacă e accesată direct)
  if (!tenant) {
    return null;
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 600 }}>
        Admin Dashboard
      </h1>

      <p style={{ marginTop: 8, color: "#666" }}>
        Salon activ: <strong>{tenant.name ?? "—"}</strong>
      </p>

      <hr style={{ margin: "24px 0" }} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        <DashboardCard
          title="Servicii"
          description="Gestionează serviciile oferite"
          href="/admin/dashboard/services"
        />

        <DashboardCard
          title="Program"
          description="Program săptămânal & pauze"
          href="/admin/dashboard/settings"
        />

        <DashboardCard
          title="Programări"
          description="Vezi și gestionează programările"
          href="/admin/dashboard/bookings"
        />
      </div>
    </div>
  );
}

function DashboardCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 16,
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <h3 style={{ fontSize: 18, fontWeight: 500 }}>{title}</h3>
      <p style={{ marginTop: 8, color: "#666" }}>{description}</p>
    </Link>
  );
}
