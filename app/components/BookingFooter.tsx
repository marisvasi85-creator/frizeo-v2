import Link from "next/link";
import {
  companyFooterLine,
  LEGAL_COMPANY,
  LEGAL_LINKS,
} from "@/lib/legal/company";
import CookiePreferencesButton from "./CookiePreferencesButton";

/** Footer minimal pentru paginile publice de programări — fără signup/login. */
export default function BookingFooter() {
  const companyLine = companyFooterLine();

  return (
    <footer className="border-t border-gray-200 bg-white mt-24">
      <div className="max-w-6xl mx-auto px-6 py-10 grid md:grid-cols-2 gap-8 text-sm text-gray-600">
        <div>
          <p className="font-semibold text-black mb-4">Legal</p>
          <ul className="space-y-2">
            <li>
              <Link href="/privacy" className="hover:text-black">
                Politica de confidențialitate
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-black">
                Termeni și condiții
              </Link>
            </li>
            <li>
              <Link href="/cookies" className="hover:text-black">
                Politica cookies
              </Link>
            </li>
            <li>
              <CookiePreferencesButton />
            </li>
            <li>
              <a
                href={LEGAL_LINKS.anpc}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-black"
              >
                ANPC
              </a>
            </li>
            <li>
              <a
                href={LEGAL_LINKS.sol}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-black"
              >
                Soluționare online (SOL)
              </a>
            </li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-black mb-4">Contact</p>
          <ul className="space-y-2">
            <li>
              <Link href="/contact" className="hover:text-black">
                Pagina de contact
              </Link>
            </li>
            <li>
              <a
                href={`mailto:${LEGAL_COMPANY.email}`}
                className="hover:text-black"
              >
                {LEGAL_COMPANY.email}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-gray-200 py-6 px-6 text-center text-xs text-gray-500 space-y-2">
        {companyLine && <p>{companyLine}</p>}
        <p>
          © {new Date().getFullYear()} Frizeo. Toate drepturile rezervate.
        </p>
      </div>
    </footer>
  );
}
