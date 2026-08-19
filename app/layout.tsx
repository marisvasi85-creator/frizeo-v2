import "./globals.css";
import NextTopLoader from "nextjs-toploader";
import type { Viewport } from "next";
import { Figtree, Syne } from "next/font/google";
import CookieBanner from "./components/CookieBanner";
import AnalyticsProvider from "./components/analytics/AnalyticsProvider";
import { siteMetadata } from "@/lib/site/metadata";

const appBody = Figtree({
  subsets: ["latin"],
  variable: "--font-app-body",
  display: "swap",
});

const appDisplay = Syne({
  subsets: ["latin"],
  variable: "--font-app-display",
  display: "swap",
});

export const metadata = siteMetadata;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Do not lock maximumScale — that hurts accessibility and is not the right
  // fix for overflow-looking “zoom”. Keep scale at 1 on first paint.
  themeColor: "#F3F6FA",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ro" className={`${appBody.variable} ${appDisplay.variable}`}>
      <body>
        <NextTopLoader
          color="#0B0B0C"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
        />

        {children}
        <AnalyticsProvider />
        <CookieBanner />
      </body>
    </html>
  );
}