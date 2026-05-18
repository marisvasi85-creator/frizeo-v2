import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/email";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const now = new Date();
    const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    // 🔥 1. CLEANUP PENDING EXPIRATE (CRUCIAL)
    await supabase
      .from("bookings")
      .delete()
      .eq("status", "pending")
      .lt("expires_at", now.toISOString());

    // 🔥 2. IA DOAR CE TREBUIE (optimizat)
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("id, client_email, date, start_time")
      .eq("status", "confirmed")
      .eq("reminder_2h_sent", false)
      .gte("date", now.toISOString().split("T")[0]); // doar azi+

    if (error) {
      console.error("FETCH ERROR:", error);
      return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
    }

    // 🔥 3. TRIMITE DOAR CE E ÎN FEREASTRĂ
    for (const b of bookings || []) {
      const bookingTime = new Date(`${b.date}T${b.start_time}`);

      if (bookingTime > now && bookingTime <= in2h) {
        try {
          if (b.client_email) {
            await sendEmail({
              to: b.client_email,
              subject: "Reminder programare",
              html: `
                <h3>Reminder programare</h3>
                <p>Ai programare la <b>${b.start_time}</b></p>
              `,
            });
          }

          // 🔥 marchează ca trimis (ANTI DUPLICATE)
          await supabase
            .from("bookings")
            .update({ reminder_2h_sent: true })
            .eq("id", b.id);

        } catch (err) {
          console.error("EMAIL ERROR:", err);
        }
      }
    }

    console.log("CRON OK");

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("CRON ERROR:", err);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}