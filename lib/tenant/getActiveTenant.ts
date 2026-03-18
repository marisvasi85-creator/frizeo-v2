import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getActiveTenant() {
  const cookieStore = await cookies();
  const tenantId = cookieStore.get("tenant_id")?.value;

  if (!tenantId) return null;

  const supabase = await createSupabaseServerClient();

  // ⚠️ AICI era greșeala: folosim id, nu tenant_id
  const { data, error } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("id", tenantId)
    .single();

  if (error || !data) {
    console.error("GET ACTIVE TENANT ERROR:", error);
    return null;
  }

  return {
    tenant_id: data.id, // normalizăm ca restul app-ului să folosească tenant_id
    name: data.name,
  };
}