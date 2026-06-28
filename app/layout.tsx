import "./globals.css";
import NextTopLoader from "nextjs-toploader";
import type { Viewport } from "next";
import CookieBanner from "./components/CookieBanner";
import { siteMetadata } from "@/lib/site/metadata";

export const metadata = siteMetadata;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B0B0C",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ro">
      <body>
        <NextTopLoader
          color="#3B82F6"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
        />

        {children}
        <CookieBanner />
      </body>
    </html>
  );
}