import Link from "next/link";

export default function Page() {
  return (
    <main className="bg-white text-gray-900">

      {/* HERO */}
      <section className="px-6 py-24 text-center max-w-4xl mx-auto">
        <p className="text-sm font-medium text-gray-500 mb-4 tracking-wide uppercase">
          Programări online pentru frizerii și saloane
        </p>

        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-6">
          Nu mai pierde clienți pentru că nu poți răspunde la telefon.
        </h1>

        <p className="text-lg text-gray-600 mb-4 max-w-2xl mx-auto">
          Cu Frizeo, clienții se programează singuri — aleg serviciul, ziua
          și ora. Tu vezi totul în calendar, fără haos și fără apeluri
          întrerupte.
        </p>

        <p className="text-base text-gray-500 mb-10 max-w-xl mx-auto">
          Link personal de programări, confirmări și reminder-e automate
          prin email și SMS.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/signup"
            className="bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition font-medium"
          >
            Creează cont gratuit
          </Link>

          <Link
            href="/barbers"
            className="border border-gray-300 px-6 py-3 rounded-xl hover:bg-gray-100 transition font-medium"
          >
            Vezi pagina de programări
          </Link>
        </div>

        <p className="text-sm text-gray-400 mt-4">
          Fără card. Fără instalare. Gata în câteva minute.
        </p>
      </section>

      {/* CUM FUNCTIONEAZA */}
      <section id="cum-functioneaza" className="bg-gray-50 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-semibold text-center mb-4">
            Cum funcționează
          </h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            Trei pași simpli — funcționează la fel dacă lucrezi singur
            sau ai o echipă.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <p className="text-sm font-medium text-gray-400 mb-2">Pasul 1</p>
              <h3 className="font-semibold text-lg mb-2">Configurezi serviciile și programul</h3>
              <p className="text-gray-600 text-sm">
                Adaugi ce oferi (tuns, barbă etc.) și când lucrezi.
                Poți marca zile libere sau concedii oricând.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <p className="text-sm font-medium text-gray-400 mb-2">Pasul 2</p>
              <h3 className="font-semibold text-lg mb-2">Distribui link-ul tău</h3>
              <p className="text-gray-600 text-sm">
                Primești un link personal pe care îl pui în bio Instagram,
                pe site sau îl trimiți clienților direct — inclusiv pe WhatsApp.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <p className="text-sm font-medium text-gray-400 mb-2">Pasul 3</p>
              <h3 className="font-semibold text-lg mb-2">Clienții se programează singuri</h3>
              <p className="text-gray-600 text-sm">
                Aleg serviciul, data și ora disponibilă. Programarea
                apare în calendarul tău — tu doar lucrezi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* NOTIFICARI */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold mb-4">
              Confirmări și reminder-e automate
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Nu mai scrii manual mesaje de confirmare. Frizeo anunță
              clientul prin email și SMS — tu alegi ce notificări sunt active.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Ce primește clientul</h3>

              <ul className="space-y-3 text-gray-600">
                <li className="flex gap-3">
                  <span className="text-green-600 shrink-0">✓</span>
                  <span>
                    <strong className="text-gray-900">Confirmare</strong> imediat
                    după programare — email și/sau SMS
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-green-600 shrink-0">✓</span>
                  <span>
                    <strong className="text-gray-900">Reminder</strong> înainte
                    de programare, ca să nu uite
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-green-600 shrink-0">✓</span>
                  <span>
                    Notificare la <strong className="text-gray-900">reprogramare</strong>{" "}
                    sau <strong className="text-gray-900">anulare</strong>
                  </span>
                </li>
              </ul>
            </div>

            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 space-y-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                Exemplu SMS reminder
              </p>
              <div className="bg-white rounded-xl p-4 border border-gray-200 text-sm text-gray-700 leading-relaxed">
                <p className="font-medium text-gray-900 mb-1">Frizeo</p>
                <p>Reminder: ai programare astăzi la ora 14:00.</p>
                <p className="mt-1 text-gray-500">Te așteptăm!</p>
              </div>

              <p className="text-xs text-gray-500">
                Poți activa sau dezactiva fiecare tip de notificare
                din panoul de administrare.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEMA */}
      <section className="bg-gray-50 py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-semibold mb-6">
            Îți sună cunoscut?
          </h2>

          <div className="space-y-4 text-gray-600 text-left max-w-md mx-auto">
            <p>❌ Ești în lucru și nu poți răspunde la telefon</p>
            <p>❌ Clienții renunță când nu răspunzi la timp</p>
            <p>❌ Programările pe hârtie sau în mesaje se pierd</p>
            <p>❌ Nu știi sigur cine vine mâine și la ce oră</p>
          </div>
        </div>
      </section>

      {/* BENEFICII */}
      <section className="py-20 px-6">
        <h2 className="text-3xl font-semibold text-center mb-12">
          De ce aleg Frizeo
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
          <div>
            <p className="font-medium mb-1">Mai puține apeluri</p>
            <p className="text-gray-600 text-sm">
              Clienții se programează online, oricând.
            </p>
          </div>

          <div>
            <p className="font-medium mb-1">Programare 24/7</p>
            <p className="text-gray-600 text-sm">
              Link-ul tău e activ și noaptea, și în weekend.
            </p>
          </div>

          <div>
            <p className="font-medium mb-1">Calendar organizat</p>
            <p className="text-gray-600 text-sm">
              Toate programările într-un singur loc, pentru tine și echipă.
            </p>
          </div>

          <div>
            <p className="font-medium mb-1">Setup rapid</p>
            <p className="text-gray-600 text-sm">
              Servicii, program, link — gata în câteva minute.
            </p>
          </div>
        </div>
      </section>

      {/* DEMO */}
      <section className="bg-gray-50 py-20 px-6 text-center">
        <h2 className="text-3xl font-semibold mb-4">
          Vezi cum arată pentru clienți
        </h2>
        <p className="text-gray-600 mb-8 max-w-lg mx-auto">
          Pagină simplă de programări — serviciu, calendar, confirmare.
          Exact ce văd clienții tăi când deschid link-ul.
        </p>

        <Link
          href="/barbers"
          className="inline-block bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition font-medium"
        >
          Deschide demo
        </Link>
      </section>

      {/* CTA FINAL */}
      <section className="bg-black text-white py-20 px-6 text-center">
        <h2 className="text-3xl font-semibold mb-4">
          Începe gratuit azi
        </h2>

        <p className="mb-8 text-gray-300 max-w-lg mx-auto">
          Perioadă de probă cu toate funcțiile. Fără card,
          fără complicații — doar programări care funcționează.
        </p>

        <Link
          href="/signup"
          className="inline-block bg-white text-black px-8 py-4 rounded-xl hover:bg-gray-200 transition font-medium"
        >
          Creează cont gratuit
        </Link>
      </section>

    </main>
  );
}
