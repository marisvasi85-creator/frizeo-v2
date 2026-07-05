import Link from "next/link";
import { GOOGLE_CALENDAR_USAGE_RO, GOOGLE_POLICY_LINKS } from "@/lib/legal/googleCalendar";

export default function GoogleCalendarConnectDisclosure() {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0F0F10] p-4 space-y-3 text-sm text-white/70">
      <p className="font-medium text-white/90">Înainte de conectare</p>
      <p>
        Frizeo va accesa Google Calendar doar pentru: creare/ștergere evenimente
        la programări confirmate și verificarea orelor ocupate pe pagina publică
        de booking. Opțional — poți folosi Frizeo fără Google.
      </p>
      <ul className="list-disc pl-5 space-y-1 text-white/60">
        {GOOGLE_CALENDAR_USAGE_RO.purposes.slice(0, 3).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="text-xs text-white/50">
        Serviciu destinat pieței din România. Detalii:{" "}
        <Link href="/google-calendar-data" className="underline text-white/60">
          Utilizarea datelor Google Calendar
        </Link>
        ,{" "}
        <Link href="/privacy" className="underline text-white/60">
          Politica de confidențialitate
        </Link>
        . Revocare:{" "}
        <a
          href={GOOGLE_POLICY_LINKS.revokeAccess}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-white/60"
        >
          cont Google → Permisiuni
        </a>
        .
      </p>
    </div>
  );
}
