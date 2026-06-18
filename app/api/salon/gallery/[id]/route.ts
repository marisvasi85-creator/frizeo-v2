import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function DELETE(
  req: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await params;

    const supabase =
      await createSupabaseServerClient();

    const barber =
      await getCurrentBarberInTenant();

    if (!barber) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: image } =
      await supabase
        .from("salon_gallery")
        .select("*")
        .eq("id", id)
        .single();

    if (!image) {
      return NextResponse.json(
        { error: "Imagine inexistentă" },
        { status: 404 }
      );
    }

    if (
      image.tenant_id !==
      barber.tenant_id
    ) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // scoate calea din URL
    const url = new URL(
      image.image_url
    );

    const marker =
      "/storage/v1/object/public/salon-gallery/";

    const path =
      url.pathname.split(marker)[1];

    if (path) {
      await supabaseAdmin.storage
        .from("salon-gallery")
        .remove([path]);
    }

    await supabaseAdmin
      .from("salon_gallery")
      .delete()
      .eq("id", id);

    return NextResponse.json({
      success: true,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        error:
          e.message ||
          "Delete failed",
      },
      {
        status: 500,
      }
    );
  }
}