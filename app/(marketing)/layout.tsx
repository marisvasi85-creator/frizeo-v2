import Link from "next/link";
import Footer from "../components/Footer";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* HEADER */}
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center gap-3 min-w-0">

          {/* LOGO */}
          <Link href="/" className="font-semibold text-lg shrink-0">
            Frizeo
          </Link>

          {/* NAV */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-wrap justify-end">

            <Link
              href="/frizerii"
              className="text-sm text-gray-600 hover:text-black hidden sm:inline"
            >
              Frizerii
            </Link>

            <Link
              href="/pricing"
              className="text-sm text-gray-600 hover:text-black hidden sm:inline"
            >
              Prețuri
            </Link>

            <Link
              href="/login"
              className="text-sm text-gray-600 hover:text-black whitespace-nowrap"
            >
              Autentificare
            </Link>

            <Link
              href="/signup"
              className="bg-black text-white px-3 sm:px-4 py-2 rounded-lg text-sm hover:bg-gray-800 transition whitespace-nowrap"
            >
              Creează cont
            </Link>

          </div>
        </div>
      </header>

      {/* PAGE */}
      {children}

      {/* FOOTER */}
      <Footer />
    </>
  );
}