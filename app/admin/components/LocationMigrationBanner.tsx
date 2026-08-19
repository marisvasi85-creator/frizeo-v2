type Props = {
  ready: boolean;
};

export default function LocationMigrationBanner({ ready }: Props) {
  if (ready) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      <p className="font-medium">Migrare DB necesară pentru locație</p>
      <p className="mt-2 text-amber-700">
        Rulează în Supabase SQL Editor fișierul{" "}
        <code className="text-amber-900 font-medium">20260703_location_fields.sql</code>{" "}
        din folderul <code className="text-amber-900 font-medium">supabase/migrations</code>.
        Fără această migrare, adresa salonului nu se poate salva și harta nu
        apare pe pagina publică.
      </p>
    </div>
  );
}
