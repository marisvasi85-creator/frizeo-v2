import { noIndexMetadata } from "@/lib/site/pageMetadata";

export const metadata = noIndexMetadata;

export default function CancelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
