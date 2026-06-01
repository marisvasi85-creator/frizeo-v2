import Link from "next/link";

export default function Page() {
  return (
    <main className="bg-white text-gray-900">

      {/* HERO */}
      <section className="px-6 py-24 text-center max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-6">
          Nu mai pierde clienți pentru că nu răspunzi la telefon.
        </h1>

        <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto">
          Cu Frizeo, clienții se programează singuri.
          Tu te concentrezi pe lucru, nu pe apeluri.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/signup"
            className="bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition"
          >
            Creează cont gratuit
          </Link>

          <Link
            href="/barbers"
            className="border border-gray-300 px-6 py-3 rounded-xl hover:bg-gray-100 transition"
          >
            Vezi cum funcționează
          </Link>
        </div>

        <p className="text-sm text-gray-400 mt-4">
          Fără card. Fără instalare. Funcționează imediat.
        </p>
      </section>

      {/* PROBLEMA */}
      <section className="bg-gray-50 py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-semibold mb-6">
            Îți sună cunoscut?
          </h2>

          <div className="space-y-4 text-gray-600">
            <p>❌ Ești în lucru și nu poți răspunde la telefon</p>
            <p>❌ Clienții renunță dacă nu răspunzi</p>
            <p>❌ Programările sunt haotice</p>
            <p>❌ Scrii pe hârtie sau în WhatsApp</p>
          </div>
        </div>
      </section>

      {/* SOLUȚIA */}
      <section className="py-20 px-6 text-center">
        <h2 className="text-3xl font-semibold mb-6">
          Frizeo rezolvă asta automat.
        </h2>

        <p className="text-gray-600 max-w-2xl mx-auto mb-12">
          Primești un link personal.
          Clienții își aleg singuri ziua și ora.
          Totul apare direct în calendarul tău.
        </p>

        <div className="grid md:grid-cols-3 gap-10 max-w-5xl mx-auto text-left">
          <div>
            <h3 className="font-medium text-lg mb-2">
              Link personal
            </h3>
            <p className="text-gray-600">
              Îl trimiți pe WhatsApp sau Instagram.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-lg mb-2">
              Programări automate
            </h3>
            <p className="text-gray-600">
              Fără apeluri, fără mesaje.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-lg mb-2">
              Calendar clar
            </h3>
            <p className="text-gray-600">
              Vezi totul organizat într-un loc.
            </p>
          </div>
        </div>
      </section>

      {/* BENEFICII */}
      <section className="bg-gray-50 py-20 px-6">
        <h2 className="text-3xl font-semibold text-center mb-12">
          De ce îl folosesc frizerii
        </h2>

        <div className="grid md:grid-cols-4 gap-8 max-w-5xl mx-auto text-left">
          <div>
            <p className="font-medium">Mai puține apeluri</p>
            <p className="text-gray-600 text-sm">
              Clienții se programează singuri.
            </p>
          </div>

          <div>
            <p className="font-medium">Nu pierzi clienți</p>
            <p className="text-gray-600 text-sm">
              Programare disponibilă 24/7.
            </p>
          </div>

          <div>
            <p className="font-medium">Totul organizat</p>
            <p className="text-gray-600 text-sm">
              Fără haos și mesaje pierdute.
            </p>
          </div>

          <div>
            <p className="font-medium">Rapid</p>
            <p className="text-gray-600 text-sm">
              Îl setezi în 5 minute.
            </p>
          </div>
        </div>
      </section>

      {/* DEMO */}
      <section className="py-20 px-6 text-center">
        <h2 className="text-3xl font-semibold mb-6">
          Vezi cum arată pentru clienți
        </h2>

        <Link
          href="/barbers"
          className="bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition"
        >
          Testează demo
        </Link>
      </section>

      {/* CTA FINAL */}
      <section className="bg-black text-white py-20 px-6 text-center">
        <h2 className="text-3xl font-semibold mb-6">
          Începe gratuit azi.
        </h2>

        <p className="mb-6 text-gray-300">
          Fără riscuri. Fără complicații.
        </p>

        <Link
          href="/signup"
          className="bg-white text-black px-8 py-4 rounded-xl hover:bg-gray-200 transition"
        >
          Creează cont
        </Link>
      </section>

    </main>
  );
}