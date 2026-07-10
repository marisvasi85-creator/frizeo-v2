import { noIndexMetadata } from "@/lib/site/pageMetadata";
import InstallAppPrompt from "@/app/components/pwa/InstallAppPrompt";

export const metadata = noIndexMetadata;

export default function BookingConfirmedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <InstallAppPrompt variant="booking" />
    </>
  );
}
