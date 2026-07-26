import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isAuthError, requireTenantAccess } from "@/lib/auth/requireTenantAccess";

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

    const auth = await requireTenantAccess(["owner", "manager"]);
    if (isAuthError(auth)) return auth;

    const { data: image } =
      await supabaseAdmin
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
      auth.tenantId
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
  } catch (e: unknown) {
    return NextResponse.json(
      {
        error:
          (e instanceof Error ? e.message : null) ||
          "Delete failed",
      },
      {
        status: 500,
      }
    );
  }
}
