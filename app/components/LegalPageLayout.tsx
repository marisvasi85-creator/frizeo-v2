import Link from "next/link";
import Footer from "./Footer";
import JsonLd from "./JsonLd";
import { breadcrumbJsonLd } from "@/lib/site/jsonLd";

export default function LegalPageLayout({
  title,
  path,
  children,
}: {
  title: string;
  /** Canonical path for BreadcrumbList JSON-LD, e.g. /privacy */
  path: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Acasă", path: "/" },
          { name: title, path },
        ])}
      />
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
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-gray-500">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-black">
                Acasă
              </Link>
            </li>
            <li aria-hidden className="text-gray-300">
              /
            </li>
            <li className="text-gray-700" aria-current="page">
              {title}
            </li>
          </ol>
        </nav>
        <h1 className="text-3xl font-bold mb-2 text-gray-900">{title}</h1>
        <div className="prose prose-gray max-w-none prose-headings:font-semibold prose-a:text-blue-600">
          {children}
        </div>
      </article>

      <Footer />
    </>
  );
}
