import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isMarketingTestimonialsEnabled } from "@/lib/marketing-testimonials/config";
import { parseMarketingTestimonialFields } from "@/lib/marketing-testimonials/validation";
import { validateImageUpload } from "@/lib/uploads/imageUpload";

export async function POST(req: Request) {
  if (!isMarketingTestimonialsEnabled()) {
    return NextResponse.json(
      { error: "Recenziile nu sunt disponibile momentan." },
      { status: 404 },
    );
  }

  try {
    const formData = await req.formData();
    const parsed = parseMarketingTestimonialFields(formData);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { value } = parsed;
    let photoUrl: string | null = null;

    const photo = formData.get("photo");
    if (photo instanceof File && photo.size > 0) {
      const image = await validateImageUpload(photo);
      const path = `submissions/${Date.now()}-${crypto.randomUUID()}.${image.extension}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("frizeo-testimonial-photos")
        .upload(path, image.bytes, {
          contentType: image.contentType,
          upsert: false,
        });

      if (uploadError) {
        return NextResponse.json(
          { error: "Nu s-a putut încărca poza. Încearcă din nou." },
          { status: 500 },
        );
      }

      const {
        data: { publicUrl },
      } = supabaseAdmin.storage
        .from("frizeo-testimonial-photos")
        .getPublicUrl(path);

      photoUrl = publicUrl;
    }

    const { error } = await supabaseAdmin
      .from("frizeo_marketing_testimonials")
      .insert({
        rating: value.rating,
        author_name: value.authorName,
        salon_name: value.salonName,
        city: value.city,
        user_type: value.userType,
        body: value.body,
        photo_url: photoUrl,
        display_consent: value.displayConsent,
        status: "pending",
      });

    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json(
          { error: "Recenziile nu sunt activate încă." },
          { status: 503 },
        );
      }
      return NextResponse.json(
        { error: "Nu s-a putut salva recenzia. Încearcă din nou." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Eroare la trimitere." },
      { status: 400 },
    );
  }
}
