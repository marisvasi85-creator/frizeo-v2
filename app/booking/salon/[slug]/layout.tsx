import InstallAppPrompt from "@/app/components/pwa/InstallAppPrompt";
import FloatingPublicBookingAssistant from "@/app/booking/_components/FloatingPublicBookingAssistant";
import {
  isPublicBookingAssistantEnabled,
  isPublicBookingAssistantLlmConfigured,
} from "@/lib/public-assistant/config";
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
  const assistantEnabled = isPublicBookingAssistantEnabled() && Boolean(resolved);

  return (
    <>
      {children}
      <InstallAppPrompt variant="booking" label={salonName} />
      {assistantEnabled && resolved && (
        <FloatingPublicBookingAssistant
          configured={isPublicBookingAssistantLlmConfigured()}
          salonSlug={resolved.canonicalSlug}
          salonName={String(resolved.tenant.name || "Salon")}
        />
      )}
    </>
  );
}
