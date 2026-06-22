import Link from "next/link";
import Footer from "./Footer";

export default function LegalPageLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="border-b bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="font-semibold text-lg text-gray-900">
            Frizeo
          </Link>
          <Link href="/" className="text-sm text-gray-600 hover:text-black">
            Înapoi acasă
          </Link>
        </div>
      </header>

      <article className="max-w-4xl mx-auto px-6 py-16 text-gray-800">
        <h1 className="text-3xl font-bold mb-2 text-gray-900">{title}</h1>
        <div className="prose prose-gray max-w-none prose-headings:font-semibold prose-a:text-blue-600">
          {children}
        </div>
      </article>

      <Footer />
    </>
  );
}
