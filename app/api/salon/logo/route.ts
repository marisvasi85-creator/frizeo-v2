import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isAuthError, requireTenantAccess } from "@/lib/auth/requireTenantAccess";
import { validateImageUpload } from "@/lib/uploads/imageUpload";

export async function POST(req: Request) {
  try {
    const auth = await requireTenantAccess(["owner", "manager"]);
    if (isAuthError(auth)) return auth;

    const formData = await req.formData();

    const file =
      formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file" },
        { status: 400 }
      );
    }

    const image = await validateImageUpload(file);

    const path =
      `${auth.tenantId}/logo-${Date.now()}.${image.extension}`;

    const { error: uploadError } =
      await supabaseAdmin.storage
        .from("salon-logos")
        .upload(path, image.bytes, {
          contentType: image.contentType,
          upsert: true,
        });

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage
      .from("salon-logos")
      .getPublicUrl(path);

    await supabaseAdmin
      .from("tenants")
      .update({
        logo_url: publicUrl,
      })
      .eq("id", auth.tenantId);

    return NextResponse.json({
      success: true,
      url: publicUrl,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload eșuat" },
      { status: 400 }
    );
  }
}
