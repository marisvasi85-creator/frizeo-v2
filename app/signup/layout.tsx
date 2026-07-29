import { createPageMetadata } from "@/lib/site/pageMetadata";

export const metadata = createPageMetadata({
  title: "Creează cont",
  description:
    "Înregistrează-te pe Frizeo: frizer independent (trial Pro) sau salon (trial Pro+). Link de programări și calendar online.",
  path: "/signup",
  keywords: ["cont frizeo", "înregistrare salon frizerie", "frizer independent"],
});

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
