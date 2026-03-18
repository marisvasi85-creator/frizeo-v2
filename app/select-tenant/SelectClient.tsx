"use client";

import { useRouter } from "next/navigation";

export default function SelectClient({ tenants }: any) {
  const router = useRouter();

  async function handleSelect(tenantId: string) {
    await fetch(`/api/select-tenant?tenantId=${tenantId}`);
    router.push("/admin/dashboard");
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Alege salonul</h1>

      {tenants.map((t: any) => (
        <button
          key={t.tenant_id}
          onClick={() => handleSelect(t.tenant_id)}
          style={{ display: "block", marginTop: 10 }}
        >
          {t.name}
        </button>
      ))}
    </div>
  );
}