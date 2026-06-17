import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await req.formData();

    const file =
      formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file" },
        { status: 400 }
      );
    }

    const { data: barber } =
      await supabaseAdmin
        .from("barbers")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

    if (!barber) {
      return NextResponse.json(
        { error: "Barber not found" },
        { status: 404 }
      );
    }

    const bytes = await file.arrayBuffer();

    const buffer = Buffer.from(bytes);

    const path =
      `${barber.tenant_id}/${Date.now()}-${file.name}`;

    const { error: uploadError } =
      await supabaseAdmin.storage
        .from("salon-logos")
        .upload(path, buffer, {
          contentType: file.type,
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
      .eq("id", barber.tenant_id);

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