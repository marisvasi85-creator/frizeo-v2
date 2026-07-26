import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isAuthError, requireTenantAccess } from "@/lib/auth/requireTenantAccess";
import { validateImageUpload } from "@/lib/uploads/imageUpload";

export async function POST(req: Request) {
  try {
    const auth = await requireTenantAccess(["owner", "manager"]);
    if (isAuthError(auth)) return auth;

    const formData =
      await req.formData();

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
      `${auth.tenantId}/gallery-${Date.now()}-${crypto.randomUUID()}.${image.extension}`;

    const { error } =
      await supabaseAdmin.storage
        .from("salon-gallery")
        .upload(path, image.bytes, {
          contentType: image.contentType,
          upsert: true,
        });

    if (error) {
      throw error;
    }

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage
      .from("salon-gallery")
      .getPublicUrl(path);

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("salon_gallery")
      .insert({
        tenant_id: auth.tenantId,
        image_url: publicUrl,
      })
      .select("id, image_url, created_at")
      .single();

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      id: inserted.id,
      url: inserted.image_url ?? publicUrl,
      created_at: inserted.created_at,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload eșuat" },
      { status: 400 }
    );
  }
}
