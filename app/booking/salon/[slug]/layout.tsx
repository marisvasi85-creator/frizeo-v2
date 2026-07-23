import type { Metadata } from "next";
import InstallAppPrompt from "@/app/components/pwa/InstallAppPrompt";
import { publicSalonPath } from "@/lib/booking/publicBookingPath";
import { pwaManifestHref } from "@/lib/pwa/manifestContent";
import { resolveTenantBySlug } from "@/lib/slugs/slugRedirects";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const resolved = await resolveTenantBySlug(slug);
  const salonName =
    typeof resolved?.tenant?.name === "string" ? resolved.tenant.name : null;
  const startUrl = publicSalonPath(resolved?.canonicalSlug ?? slug);

  return {
    manifest: pwaManifestHref({
      startUrl,
      variant: "booking",
      label: salonName,
    }),
    appleWebApp: {
      capable: true,
      title: salonName?.trim().slice(0, 12) || "Programări",
      statusBarStyle: "default",
    },
  };
}

export default async function SalonBookingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const resolved = await resolveTenantBySlug(slug);
  const salonName =
    typeof resolved?.tenant?.name === "string" ? resolved.tenant.name : null;

  return (
    <>
      {children}
      <InstallAppPrompt variant="booking" label={salonName} />
    </>
  );
}
