import { noIndexMetadata } from "@/lib/site/pageMetadata";

export const metadata = {
  ...noIndexMetadata,
  title: "Resetare parolă",
};

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
