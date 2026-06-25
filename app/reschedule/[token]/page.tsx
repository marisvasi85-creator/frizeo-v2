import { supabaseAdmin } from "@/lib/supabase/admin";
import RescheduleClient from "./components/RescheduleClient";

type Props = {
  params: Promise<{
    token: string;
  }>;
};

export default async function Page({ params }: Props) {
  const { token } = await params;

  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("*")
    .eq("reschedule_token", token)
    .single();

  if (!booking) {
    return <div>Link invalid sau expirat</div>;
  }

  return <RescheduleClient booking={booking} token={token} />;
}
