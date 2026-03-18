export default function HomePage() {
  return (
    <main className="bg-white text-gray-900">
      
      {/* HERO */}
      <section className="px-6 py-20 text-center max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-6">
          Programări online simple pentru frizeri.
        </h1>

        <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto">
          Redu apelurile, elimină haosul și oferă clienților tăi
          posibilitatea de a se programa rapid, direct online.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="/signup"
            className="bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition"
          >
            Începe gratuit
          </a>

          <a
            href="/booking/demo"
            className="border border-gray-300 px-6 py-3 rounded-xl hover:bg-gray-100 transition"
          >
            Vezi demo
          </a>
        </div>
      </section>

      {/* HOW IT WORKS */}
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
                Configurezi orele de lucru și serviciile oferite.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-lg mb-2">
                2. Primești un link personal
              </h3>
              <p className="text-gray-600">
                Trimiți linkul către clienții tăi.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-lg mb-2">
                3. Clienții se programează
              </h3>
              <p className="text-gray-600">
                Programările apar automat în panoul tău.
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
            <p className="font-medium">Mai puține apeluri</p>
            <p className="text-gray-600 text-sm">
              Clienții se programează singuri, fără telefoane.
            </p>
          </div>

          <div>
            <p className="font-medium">Organizare clară</p>
            <p className="text-gray-600 text-sm">
              Vezi toate programările într-un singur loc.
            </p>
          </div>

          <div>
            <p className="font-medium">Link personal</p>
            <p className="text-gray-600 text-sm">
              Fiecare frizer are propria pagină de programări.
            </p>
          </div>

          <div>
            <p className="font-medium">Rapid și simplu</p>
            <p className="text-gray-600 text-sm">
              Fără instalări, funcționează direct în browser.
            </p>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-black text-white py-20 px-6 text-center">
        <h2 className="text-3xl font-semibold mb-6">
          Simplifică-ți programările azi.
        </h2>

        <a
          href="/signup"
          className="bg-white text-black px-8 py-4 rounded-xl hover:bg-gray-200 transition"
        >
          Creează cont gratuit
        </a>
      </section>

    </main>
  );
}