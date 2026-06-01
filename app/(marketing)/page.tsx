import Link from "next/link";

export default function Page() {
  return (
    <main className="bg-white text-gray-900">

      {/* HERO */}
      <section className="px-6 py-24 text-center max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-6">
          Nu mai răspunde la telefon în timp ce tunzi.
        </h1>

        <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto">
          Clienții se programează singuri, direct online.
          Tu te concentrezi pe lucru.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/signup"
            className="bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition"
          >
            Începe gratuit
          </Link>

          <Link
            href="/barbers"
            className="border border-gray-300 px-6 py-3 rounded-xl hover:bg-gray-100 transition"
          >
            Vezi demo
          </Link>
        </div>
      </section>

      {/* CUM FUNCȚIONEAZĂ */}
      <section className="bg-gray-50 py-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl font-semibold mb-12">
            Cum funcționează
          </h2>

          <div className="grid md:grid-cols-3 gap-10 text-left">
            <div>
              <h3 className="font-medium text-lg mb-2">
                1. Îți setezi programul
              </h3>
              <p className="text-gray-600">
                Configurezi orele și serviciile în câteva minute.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-lg mb-2">
                2. Primești link personal
              </h3>
              <p className="text-gray-600">
                Îl trimiți clienților tăi pe WhatsApp sau Instagram.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-lg mb-2">
                3. Clienții se programează
              </h3>
              <p className="text-gray-600">
                Programările apar automat în calendarul tău.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFICII */}
      <section className="py-20 px-6 text-center">
        <h2 className="text-3xl font-semibold mb-12">
          De ce Frizeo?
        </h2>

        <div className="grid md:grid-cols-4 gap-8 max-w-5xl mx-auto text-left">
          <div>
            <p className="font-medium">Fără telefoane</p>
            <p className="text-gray-600 text-sm">
              Clienții se programează singuri.
            </p>
          </div>

          <div>
            <p className="font-medium">Program organizat</p>
            <p className="text-gray-600 text-sm">
              Vezi totul clar într-un calendar.
            </p>
          </div>

          <div>
            <p className="font-medium">Link personal</p>
            <p className="text-gray-600 text-sm">
              Fiecare frizer are pagina lui.
            </p>
          </div>

          <div>
            <p className="font-medium">Rapid și simplu</p>
            <p className="text-gray-600 text-sm">
              Funcționează direct în browser.
            </p>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="bg-black text-white py-20 px-6 text-center">
        <h2 className="text-3xl font-semibold mb-6">
          Simplifică-ți programările azi.
        </h2>

        <Link
          href="/signup"
          className="bg-white text-black px-8 py-4 rounded-xl hover:bg-gray-200 transition"
        >
          Creează cont gratuit
        </Link>
      </section>

    </main>
  );
}