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
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">

          {/* LOGO */}
          <Link href="/" className="font-semibold text-lg">
            Frizeo
          </Link>

          {/* NAV */}
          <div className="flex items-center gap-4">

            <Link
              href="/login"
              className="text-sm text-gray-600 hover:text-black"
            >
              Login
            </Link>

            <Link
              href="/signup"
              className="bg-black text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 transition"
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