import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white mt-24">
      <div className="max-w-6xl mx-auto px-6 py-12 grid md:grid-cols-4 gap-10 text-sm text-gray-600">

        <div>
          <p className="font-semibold text-black mb-4">
            Frizeo
          </p>

          <p>
            Platformă simplă de programări online pentru
            frizerii, barbershop-uri și saloane moderne.
          </p>
        </div>

        <div>
          <p className="font-semibold text-black mb-4">
            Produs
          </p>

          <ul className="space-y-2">
            <li>
              <Link href="/barbers" className="hover:text-black">
                Cum funcționează
              </Link>
            </li>

            <li>
              <Link
                href="/signup"
                className="hover:text-black"
              >
                Creează cont
              </Link>
            </li>

            <li>
              <Link href="/login" className="hover:text-black">
                Autentificare
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-black mb-4">
            Legal
          </p>

          <ul className="space-y-2">

            <li>
              <Link
                href="/privacy"
                className="hover:text-black"
              >
                Politica de confidențialitate
              </Link>
            </li>

            <li>
              <Link
                href="/terms"
                className="hover:text-black"
              >
                Termeni și condiții
              </Link>
            </li>

            <li>
              <Link
                href="/cookies"
                className="hover:text-black"
              >
                Politica cookies
              </Link>
            </li>

          </ul>
        </div>

        <div>
          <p className="font-semibold text-black mb-4">
            Contact
          </p>

          <ul className="space-y-2">
            <li>
              info@frizeo.ro
            </li>

            <li>
              România
            </li>
          </ul>
        </div>

      </div>

      <div className="border-t border-gray-200 py-6 text-center text-xs text-gray-500">

        © {new Date().getFullYear()} Frizeo.
        Toate drepturile rezervate.

      </div>
    </footer>
  );
}