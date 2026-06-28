import { createPageMetadata } from "@/lib/site/pageMetadata";

export const metadata = createPageMetadata({
  title: "Creează cont",
  description:
    "Înregistrează-ți salonul pe Frizeo. Trial Pro+ gratuit, link de programări și calendar online.",
  path: "/signup",
  keywords: ["cont frizeo", "înregistrare salon frizerie"],
});

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
