import { Suspense } from "react";
import { noIndexMetadata } from "@/lib/site/pageMetadata";

export const metadata = {
  ...noIndexMetadata,
  title: "Autentificare",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
