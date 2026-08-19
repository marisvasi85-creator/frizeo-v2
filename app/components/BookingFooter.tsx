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
    <footer className="border-t border-frz-line bg-frz-fog mt-24">
      <div className="max-w-6xl mx-auto px-6 py-10 grid md:grid-cols-2 gap-8 text-sm text-frz-muted">
        <div>
          <p className="font-semibold text-frz-ink mb-4">Legal</p>
          <ul className="space-y-2">
            <li>
              <Link href="/privacy" className="hover:text-frz-ink">
                Politica de confidențialitate
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-frz-ink">
                Termeni și condiții
              </Link>
            </li>
            <li>
              <Link href="/cookies" className="hover:text-frz-ink">
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
                className="hover:text-frz-ink"
              >
                ANPC
              </a>
            </li>
            <li>
              <a
                href={LEGAL_LINKS.sol}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-frz-ink"
              >
                Soluționare online (SOL)
              </a>
            </li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-frz-ink mb-4">Contact</p>
          <ul className="space-y-2">
            <li>
              <Link href="/contact" className="hover:text-frz-ink">
                Pagina de contact
              </Link>
            </li>
            <li>
              <a
                href={`mailto:${LEGAL_COMPANY.email}`}
                className="hover:text-frz-ink"
              >
                {LEGAL_COMPANY.email}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-frz-line py-6 px-6 text-center text-xs text-frz-muted space-y-2">
        {companyLine && <p>{companyLine}</p>}
        <p>
          © {new Date().getFullYear()} Frizeo. Toate drepturile rezervate.
        </p>
      </div>
    </footer>
  );
}
