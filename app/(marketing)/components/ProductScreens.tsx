/** Product surface previews for the marketing page — dashboard, calendar, booking. */
export default function ProductScreens() {
  return (
    <div className="mt-14 space-y-14">
      {/* Dashboard */}
      <figure
        className="grid items-center gap-8 md:grid-cols-[1.15fr_0.85fr]"
        aria-label="Previzualizare dashboard Frizeo cu programările zilei"
      >
        <div className="overflow-hidden rounded-2xl border border-[var(--mkt-line)] bg-[var(--mkt-ink)] text-white shadow-[0_20px_60px_-40px_rgba(11,11,12,0.55)]">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <span className="h-2 w-2 rounded-full bg-white/20" />
            <span className="h-2 w-2 rounded-full bg-white/20" />
            <span className="h-2 w-2 rounded-full bg-white/20" />
            <span className="ml-2 text-[11px] text-white/40">Dashboard</span>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-3">
            {[
              { label: "Azi", value: "6" },
              { label: "Săptămâna", value: "28" },
              { label: "Confirmate", value: "24" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3"
              >
                <p className="text-[11px] text-white/45">{stat.label}</p>
                <p className="mkt-display mt-1 text-2xl">{stat.value}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2 px-4 pb-4">
            {[
              { time: "10:00", name: "Andrei P.", service: "Fade clasic" },
              { time: "11:30", name: "Mihai R.", service: "Tuns + barbă" },
              { time: "13:00", name: "Cosmin D.", service: "Contur" },
            ].map((row) => (
              <div
                key={row.time}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-[#161618] px-3 py-2.5 text-sm"
              >
                <span className="text-white/50">{row.time}</span>
                <span className="font-medium">{row.name}</span>
                <span className="text-white/45">{row.service}</span>
              </div>
            ))}
          </div>
        </div>
        <figcaption>
          <p className="mkt-display text-xl">
            Tu doar îți verifici calendarul
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--mkt-muted)]">
            Clienții se programează singuri, iar SMS Reminder este trimis
            automat. Tu vezi cine vine, la ce oră și pentru ce serviciu.
          </p>
        </figcaption>
      </figure>

      {/* Calendar */}
      <figure
        className="grid items-center gap-8 md:grid-cols-[0.85fr_1.15fr]"
        aria-label="Previzualizare calendar Frizeo cu sync Google Calendar"
      >
        <figcaption className="md:order-1 order-2">
          <p className="mkt-display text-xl">Fără ore dublate</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--mkt-muted)]">
            Frizeo și Google Calendar rămân sincronizate automat — fără să
            actualizezi două agende.
          </p>
        </figcaption>
        <div className="order-1 overflow-hidden rounded-2xl border border-[var(--mkt-line)] bg-white md:order-2">
          <div className="flex items-center justify-between border-b border-[var(--mkt-line)] px-4 py-3">
            <p className="text-sm font-semibold">Săptămâna 27–31 iul</p>
            <p className="text-xs text-[var(--mkt-muted)]">Google sync activ</p>
          </div>
          <div className="grid grid-cols-5 gap-px bg-[var(--mkt-line)]">
            {[
              {
                day: "Lun",
                slots: [
                  { t: "10:00", s: "Fade" },
                  { t: "14:00", s: "Barbă" },
                ],
              },
              {
                day: "Mar",
                slots: [
                  { t: "11:30", s: "Tuns" },
                  { t: "16:00", s: "Fade" },
                ],
              },
              {
                day: "Mie",
                slots: [{ t: "09:30", s: "Contur" }],
              },
              {
                day: "Joi",
                slots: [
                  { t: "12:00", s: "Tuns+" },
                  { t: "15:30", s: "Fade" },
                ],
              },
              {
                day: "Vin",
                slots: [
                  { t: "10:45", s: "Fade" },
                  { t: "13:15", s: "Barbă" },
                  { t: "17:00", s: "Tuns" },
                ],
              },
            ].map((col) => (
              <div key={col.day} className="min-h-[160px] bg-[var(--mkt-fog)] p-2">
                <p className="mb-2 text-[11px] font-medium text-[var(--mkt-muted)]">
                  {col.day}
                </p>
                <div className="space-y-1.5">
                  {col.slots.map((slot) => (
                    <div
                      key={`${col.day}-${slot.t}`}
                      className="rounded-md bg-[var(--mkt-ink)] px-1.5 py-1 text-[10px] text-white"
                    >
                      <p className="opacity-70">{slot.t}</p>
                      <p className="font-medium">{slot.s}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </figure>

      {/* Booking page */}
      <figure
        className="grid items-center gap-8 md:grid-cols-[1.15fr_0.85fr]"
        aria-label="Previzualizare pagină publică de programări Frizeo"
      >
        <div className="overflow-hidden rounded-2xl border border-[var(--mkt-line)] bg-white">
          <div className="border-b border-[var(--mkt-line)] bg-[var(--mkt-fog)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--mkt-muted)]">
              frizeo.ro/booking/…
            </p>
            <p className="mkt-display mt-1 text-lg">Studio Fade</p>
          </div>
          <div className="space-y-3 p-4">
            <div className="rounded-xl border border-[var(--mkt-accent)] bg-[var(--mkt-accent-soft)] px-3 py-3">
              <p className="text-sm font-semibold">Fade clasic</p>
              <p className="text-xs text-[var(--mkt-muted)]">45 min · 70 lei</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {["Mar 28", "Mie 29", "Joi 30"].map((d, i) => (
                <span
                  key={d}
                  className={`rounded-lg px-3 py-2 text-xs font-medium ${
                    i === 0
                      ? "bg-[var(--mkt-ink)] text-white"
                      : "bg-[var(--mkt-fog)] text-[var(--mkt-steel)]"
                  }`}
                >
                  {d}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {["10:00", "11:30", "13:00", "15:30"].map((t, i) => (
                <span
                  key={t}
                  className={`rounded-lg border py-2 text-center text-xs ${
                    i === 1
                      ? "border-[var(--mkt-accent)] bg-[var(--mkt-accent)] text-white"
                      : "border-[var(--mkt-line)] text-[var(--mkt-steel)]"
                  }`}
                >
                  {t}
                </span>
              ))}
            </div>
            <div className="rounded-xl bg-[var(--mkt-ink)] py-3 text-center text-sm font-semibold text-white">
              Confirmă programarea
            </div>
          </div>
        </div>
        <figcaption>
          <p className="mkt-display text-xl">Clienții rezervă singuri</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--mkt-muted)]">
            Pagina ta de programări din bio sau WhatsApp — tu nu mai răspunzi la
            telefon în timp ce tunzi.
          </p>
        </figcaption>
      </figure>
    </div>
  );
}
