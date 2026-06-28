import { NextResponse } from "next/server";
import {
  billingProfileToDbUpdate,
  rowToBillingProfile,
  validateBillingProfileInput,
  type TenantBillingRow,
} from "@/lib/billing/billingProfile";
import { getCurrentRole } from "@/lib/auth/getCurrentRole";
import { getActiveTenant } from "@/lib/tenant/getActiveTenant";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BILLING_COLUMNS =
  "billing_type, billing_name, billing_cui, billing_reg_com, billing_address_line1, billing_city, billing_county, billing_postal_code, billing_country";

export async function GET() {
  const role = await getCurrentRole();
  if (role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const tenant = await getActiveTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("tenants")
    .select(BILLING_COLUMNS)
    .eq("id", tenant.tenant_id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Datele de facturare nu au putut fi încărcate." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    profile: rowToBillingProfile(data as TenantBillingRow),
  });
}

export async function POST(req: Request) {
  const role = await getCurrentRole();
  if (role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const tenant = await getActiveTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const validated = validateBillingProfileInput(body);

  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("tenants")
    .update(billingProfileToDbUpdate(validated.profile))
    .eq("id", tenant.tenant_id);

  if (error) {
    console.error("billing/profile update:", error);
    return NextResponse.json(
      { error: "Nu s-au putut salva datele de facturare." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, profile: validated.profile });
}
