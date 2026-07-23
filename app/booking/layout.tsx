import type { Metadata, Viewport } from "next";
import BookingFooter from "@/app/components/BookingFooter";

export const metadata: Metadata = {
  appleWebApp: {
    capable: true,
    title: "Programări",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
};

export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white min-h-screen min-w-0 max-w-[100vw] overflow-x-clip">
      {children}

      <BookingFooter />
    </div>
  );
}