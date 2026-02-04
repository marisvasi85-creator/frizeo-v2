export default function BookingConfirmed({ bookingId }: { bookingId: string }) {
  return (
    <div className="max-w-md mx-auto text-center space-y-4 py-12">
      <h1 className="text-2xl font-semibold">Programare confirmată ✅</h1>
      <p>Am trimis un email de confirmare.</p>
      <p className="text-sm text-gray-500">
        Verifică inbox / spam.
      </p>
    </div>
  );
}
