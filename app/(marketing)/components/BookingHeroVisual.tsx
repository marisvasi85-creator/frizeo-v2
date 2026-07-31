/** Full-bleed product plane for the marketing hero — booking UI as visual anchor. */
export default function BookingHeroVisual() {
  return (
    <div className="mkt-hero-visual-motion relative w-full overflow-hidden border-t border-[var(--mkt-line)] bg-[var(--mkt-ink)] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 50% 80% at 70% 40%, rgba(31,111,235,0.35), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.04), transparent 40%)",
        }}
      />

      <div className="relative mx-auto grid max-w-6xl gap-0 px-4 py-8 sm:px-6 sm:py-10 md:grid-cols-[1.1fr_0.9fr] md:gap-10 md:py-12">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
            Pagina ta de programări
          </p>
          <p className="mkt-display mt-2 text-2xl sm:text-3xl">Studio Fade</p>
          <p className="mt-1 text-sm text-white/55">
            Clientul rezervă online — tu nu mai răspunzi la telefon în timp ce
            tunzi
          </p>

          <div className="mt-6 grid gap-2 sm:grid-cols-3">
            {[
              { name: "Fade clasic", meta: "45 min · 70 lei" },
              { name: "Tuns + barbă", meta: "60 min · 100 lei" },
              { name: "Contur", meta: "20 min · 40 lei" },
            ].map((service, i) => (
              <div
                key={service.name}
                className={`rounded-xl border px-3 py-3 ${
                  i === 0
                    ? "border-[var(--mkt-accent)] bg-white/10"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <p className="text-sm font-medium">{service.name}</p>
                <p className="mt-1 text-xs text-white/50">{service.meta}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {["Lun 27", "Mar 28", "Mie 29", "Joi 30"].map((day, i) => (
              <span
                key={day}
                className={`rounded-lg px-3 py-2 text-xs font-medium ${
                  i === 1
                    ? "bg-white text-[var(--mkt-ink)]"
                    : "bg-white/5 text-white/70"
                }`}
              >
                {day}
              </span>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {["10:00", "10:45", "11:30", "13:00", "14:00", "15:30"].map(
              (slot, i) => (
                <span
                  key={slot}
                  className={`rounded-lg border py-2 text-center text-xs ${
                    i === 2
                      ? "border-[var(--mkt-accent)] bg-[var(--mkt-accent)] text-white"
                      : "border-white/10 text-white/65"
                  }`}
                >
                  {slot}
                </span>
              )
            )}
          </div>
        </div>

        <div className="mt-8 border-t border-white/10 pt-6 md:mt-0 md:border-l md:border-t-0 md:pl-10 md:pt-0">
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
            Mai puține programări uitate
          </p>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <p className="text-xs text-white/45">Email</p>
              <p className="mt-1 text-sm">
                Programare confirmată — Fade clasic, marți 11:30
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <p className="text-xs text-white/45">SMS reminder</p>
              <p className="mt-1 text-sm">
                Reminder: ai programare astăzi la 11:30. Te așteptăm!
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <p className="text-xs text-white/45">Google Calendar</p>
              <p className="mt-1 text-sm">
                Slot blocat automat — fără dubluri
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
