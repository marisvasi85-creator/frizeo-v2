type Props = {
  ready: boolean;
};

export default function LocationMigrationBanner({ ready }: Props) {
  if (ready) return null;

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
      <p className="font-medium">Migrare DB necesară pentru locație</p>
      <p className="mt-2 text-amber-100/90">
        Rulează în Supabase SQL Editor fișierul{" "}
        <code className="text-amber-50">20260703_location_fields.sql</code>{" "}
        din folderul <code className="text-amber-50">supabase/migrations</code>.
        Fără această migrare, adresa salonului nu se poate salva și harta nu
        apare pe pagina publică.
      </p>
    </div>
  );
}
