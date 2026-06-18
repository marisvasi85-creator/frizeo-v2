import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";

export async function POST(req: Request) {
  try {
    const barber =
      await getCurrentBarberInTenant();

    if (!barber) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

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

    const bytes =
      await file.arrayBuffer();

    const buffer =
      Buffer.from(bytes);

    const fileName =
      `${Date.now()}-${file.name}`;

    const path =
      `${barber.tenant_id}/${fileName}`;

    const { error } =
      await supabaseAdmin.storage
        .from("salon-gallery")
        .upload(path, buffer, {
          contentType: file.type,
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

    await supabaseAdmin
      .from("salon_gallery")
      .insert({
        tenant_id:
          barber.tenant_id,
        image_url: publicUrl,
      });

    return NextResponse.json({
      success: true,
      url: publicUrl,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: 500 }
    );
  }
}