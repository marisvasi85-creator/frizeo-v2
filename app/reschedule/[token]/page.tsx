import { createClient } from "@supabase/supabase-js";
import RescheduleClient from "./components/RescheduleClient";

type Props = {
  params: Promise<{
    token: string;
  }>;
};

export default async function Page({ params }: Props) {
  const { token } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: booking } = await supabase
  .from("bookings")
  .select("*")
  .eq("reschedule_token", token)
  .single();

  if (!booking) {
    return <div>Link invalid sau expirat</div>;
  }

  return <RescheduleClient booking={booking} token={token} />;
}