import { supabaseAdmin } from "@/lib/supabase/admin";
import InstallAppPrompt from "@/app/components/pwa/InstallAppPrompt";

async function getSalonName(slug: string) {
  const { data } = await supabaseAdmin
    .from("tenants")
    .select("name")
    .eq("slug", slug)
    .maybeSingle();

  return data?.name ?? null;
}

export default async function SalonBookingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const salonName = await getSalonName(slug);

  return (
    <>
      {children}
      <InstallAppPrompt variant="booking" label={salonName} />
    </>
  );
}
