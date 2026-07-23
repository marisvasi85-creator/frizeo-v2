import type { Metadata } from "next";
import InstallAppPrompt from "@/app/components/pwa/InstallAppPrompt";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    title: "Programări",
    statusBarStyle: "default",
  },
};

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
