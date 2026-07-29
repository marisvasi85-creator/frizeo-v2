import Link from "next/link";
import { Figtree, Syne } from "next/font/google";
import Footer from "../components/Footer";
import "./marketing.css";

const display = Syne({
  subsets: ["latin"],
  variable: "--font-mkt-display",
  display: "swap",
});

const body = Figtree({
  subsets: ["latin"],
  variable: "--font-mkt-body",
  display: "swap",
});

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${display.variable} ${body.variable} mkt mkt-body`}>
      <header className="sticky top-0 z-40 border-b border-[var(--mkt-line)]/80 bg-[rgba(243,246,250,0.86)] backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center gap-3 min-w-0">
          <Link
            href="/"
            className="mkt-display text-2xl sm:text-[1.7rem] text-[var(--mkt-ink)] shrink-0"
          >
            Frizeo
          </Link>

          <div className="flex items-center gap-2 sm:gap-5 min-w-0 flex-wrap justify-end">
            <Link
              href="/faq"
              className="text-sm text-[var(--mkt-muted)] hover:text-[var(--mkt-ink)] hidden sm:inline transition"
            >
              FAQ
            </Link>

            <Link
              href="/frizerii"
              className="text-sm text-[var(--mkt-muted)] hover:text-[var(--mkt-ink)] hidden sm:inline transition"
            >
              Frizerii
            </Link>

            <Link
              href="/pricing"
              className="text-sm text-[var(--mkt-muted)] hover:text-[var(--mkt-ink)] hidden sm:inline transition"
            >
              Prețuri
            </Link>

            <Link
              href="/login"
              className="text-sm text-[var(--mkt-muted)] hover:text-[var(--mkt-ink)] whitespace-nowrap transition"
            >
              Autentificare
            </Link>

            <Link
              href="/signup"
              className="bg-[var(--mkt-ink)] text-white px-3 sm:px-4 py-2 rounded-lg text-sm hover:bg-[var(--mkt-ink-soft)] transition whitespace-nowrap"
            >
              Creează cont
            </Link>
          </div>
        </div>
      </header>

      {children}

      <Footer />
    </div>
  );
}
