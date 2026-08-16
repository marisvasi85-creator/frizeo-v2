import type { Metadata } from "next";
import { publicSalonPath } from "@/lib/booking/publicBookingPath";
import { pwaIconHref, pwaManifestHref } from "@/lib/pwa/manifestContent";
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
  const logo =
    typeof resolved?.tenant?.logo_url === "string" && resolved.tenant.logo_url
      ? resolved.tenant.logo_url
      : null;
  const startUrl = publicSalonPath(resolved?.canonicalSlug ?? slug);
  const hasBrand = Boolean(salonName?.trim() || logo);

  return {
    manifest: pwaManifestHref({
      startUrl,
      variant: "booking",
      label: salonName,
      logo,
    }),
    appleWebApp: {
      capable: true,
      title: salonName?.trim().slice(0, 12) || "Programări",
      statusBarStyle: "default",
    },
    ...(hasBrand
      ? {
          icons: {
            apple: pwaIconHref({
              size: 180,
              label: salonName,
              logo,
            }),
            icon: [
              {
                url: pwaIconHref({
                  size: 192,
                  label: salonName,
                  logo,
                }),
                sizes: "192x192",
                type: "image/png",
              },
            ],
          },
        }
      : {}),
  };
}

export default async function SalonBookingLayout({
  children,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  return children;
}
