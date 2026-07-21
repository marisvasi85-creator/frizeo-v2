import InstallAppPrompt from "@/app/components/pwa/InstallAppPrompt";
import { resolveTenantBySlug } from "@/lib/slugs/slugRedirects";

export default async function SalonBookingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const resolved = await resolveTenantBySlug(slug);
  const salonName = resolved?.tenant?.name ?? null;

  return (
    <>
      {children}
      <InstallAppPrompt variant="booking" label={salonName} />
    </>
  );
}
