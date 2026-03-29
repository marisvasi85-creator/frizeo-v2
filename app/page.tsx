"use client";

import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#0B0B0C] text-white flex flex-col">
      {/* HEADER */}
      <header className="flex justify-between items-center px-6 py-4 border-b border-white/10">
        <h1 className="text-xl font-semibold tracking-wide">Frizeo</h1>

        <div className="flex gap-4">
          <button
            onClick={() => router.push("/login")}
            className="text-sm text-white/70 hover:text-white transition"
          >
            Login
          </button>

          <button
            onClick={() => router.push("/signup")}
            className="bg-white text-black px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
          >
            Creează cont
          </button>
        </div>
      </header>

      {/* HERO */}
      <section className="flex flex-col items-center text-center px-6 py-20">
        <h2 className="text-4xl md:text-5xl font-semibold max-w-3xl leading-tight">
          Gestionează programările frizeriei tale fără stres
        </h2>

        <p className="mt-6 text-white/60 max-w-xl text-lg">
          Programări online, calendar inteligent și control total asupra
          clienților tăi.
        </p>

        <div className="mt-8 flex gap-4">
          <button
            onClick={() => router.push("/signup")}
            className="bg-white text-black px-6 py-3 rounded-xl font-medium hover:opacity-90 transition"
          >
            Încearcă gratuit
          </button>

          <button
            onClick={() => router.push("/login")}
            className="border border-white/20 px-6 py-3 rounded-xl font-medium text-white/80 hover:text-white hover:border-white/40 transition"
          >
            Login
          </button>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="px-6 py-16 border-t border-white/10">
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
            <h3 className="text-lg font-medium">📅 Calendar inteligent</h3>
            <p className="text-white/60 mt-2 text-sm">
              Vezi toate programările într-un singur loc, fără haos.
            </p>
          </div>

          <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
            <h3 className="text-lg font-medium">📲 Programări online</h3>
            <p className="text-white/60 mt-2 text-sm">
              Clienții rezervă singuri, fără telefoane.
            </p>
          </div>

          <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
            <h3 className="text-lg font-medium">⚡ Rapid și simplu</h3>
            <p className="text-white/60 mt-2 text-sm">
              Setup în câteva minute. Fără complicații.
            </p>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="px-6 py-16 border-t border-white/10">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-2xl font-semibold mb-10">
            Cum funcționează
          </h3>

          <div className="grid md:grid-cols-3 gap-8 text-left">
            <div>
              <p className="text-white/40 text-sm">Pasul 1</p>
              <h4 className="text-lg font-medium mt-1">Creezi cont</h4>
            </div>

            <div>
              <p className="text-white/40 text-sm">Pasul 2</p>
              <h4 className="text-lg font-medium mt-1">Adaugi servicii</h4>
            </div>

            <div>
              <p className="text-white/40 text-sm">Pasul 3</p>
              <h4 className="text-lg font-medium mt-1">
                Primești programări
              </h4>
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="px-6 py-20 border-t border-white/10 text-center">
        <h3 className="text-3xl font-semibold">
          Începe gratuit acum
        </h3>

        <p className="text-white/60 mt-4">
          Fără costuri. Fără complicații.
        </p>

        <button
          onClick={() => router.push("/signup")}
          className="mt-8 bg-white text-black px-8 py-4 rounded-xl font-medium hover:opacity-90 transition"
        >
          Creează cont
        </button>
      </section>

      {/* FOOTER */}
      <footer className="text-center text-white/40 text-sm py-6 border-t border-white/10">
        © {new Date().getFullYear()} Frizeo
      </footer>
    </main>
  );
}