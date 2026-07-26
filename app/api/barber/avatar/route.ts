import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateImageUpload } from "@/lib/uploads/imageUpload";

export async function POST(req: Request) {
  try {
    const supabase =
      await createSupabaseServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
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

    const { data: barber } =
      await supabase
        .from("barbers")
        .select("id")
        .eq("user_id", user.id)
        .single();

    if (!barber) {
      return NextResponse.json(
        { error: "Barber not found" },
        { status: 404 }
      );
    }

    const image = await validateImageUpload(file);

    const path =
      `${barber.id}/avatar.${image.extension}`;

    const { error } =
      await supabaseAdmin.storage
        .from("barber-avatars")
        .upload(path, image.bytes, {
          upsert: true,
          contentType: image.contentType,
        });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    const { data } =
      supabaseAdmin.storage
        .from("barber-avatars")
        .getPublicUrl(path);

    await supabaseAdmin
      .from("barbers")
      .update({
        avatar_url:
          data.publicUrl,
      })
      .eq("id", barber.id);

    return NextResponse.json({
      success: true,
      url: data.publicUrl,
    });

  } catch (e: unknown) {

    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload eșuat" },
      { status: 400 }
    );

  }
}
