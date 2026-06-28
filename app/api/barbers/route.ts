import { NextResponse } from "next/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureBarberSlug } from "@/lib/barbers/ensureBarberSlug";

export async function GET() {
  try {
    const barber = await getCurrentBarberInTenant();

    if (!barber) {
      return NextResponse.json({ barbers: [] }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("barbers")
      .select(`
  id,
  display_name,
  phone,
  active,
  slug,
  tenant_id
`)
      .eq("tenant_id", barber.tenant_id)
      .order("display_name");

    if (error) {
      console.error("BARBERS FETCH ERROR:", error);

      return NextResponse.json({ barbers: [] }, { status: 500 });
    }

    const barbers = await Promise.all(
      (data || []).map(async (row) => {
        if (row.slug) {
          return row;
        }

        try {
          const slug = await ensureBarberSlug({
            id: row.id,
            tenant_id: row.tenant_id,
            display_name: row.display_name,
            slug: row.slug,
          });

          return { ...row, slug };
        } catch (slugError) {
          console.error("BARBER SLUG ERROR:", slugError);
          return row;
        }
      })
    );

    return NextResponse.json({
      barbers,
    });

  } catch (err) {
    console.error("BARBERS API ERROR:", err);

    return NextResponse.json(
      { barbers: [] },
      { status: 500 }
    );
  }
}