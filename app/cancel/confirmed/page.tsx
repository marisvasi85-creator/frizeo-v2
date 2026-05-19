export default function CancelConfirmed() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <h2 className="text-2xl text-green-600 font-semibold">
          ✔ Programare anulată
        </h2>
        <p className="text-gray-500">
          Programarea a fost anulată cu succes.
        </p>
      </div>
    </div>
  );
}