"use client";

export default function BookingLinkCard({
  barberId,
}: {
  barberId: string;
}) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const url = `${appUrl}/booking/${barberId}`;

  return (
    <div className="bg-white border rounded-xl p-4 mb-6">
      <p className="text-sm text-gray-500 mb-2">
        Linkul tău de programări
      </p>
      <p className="text-xs text-gray-400 mt-2">
  Trimite acest link clienților pentru programări online.
</p>
      <div className="flex gap-2">
        <input
          value={url}
          readOnly
          className="flex-1 border px-3 py-2 rounded text-sm text-black bg-gray-50"
        />

        <button
          onClick={() => navigator.clipboard.writeText(url)}
          className="px-3 py-2 bg-black text-white rounded text-sm"
        >
          Copiază
        </button>

        <a
          href={`/booking/${barberId}`}
          target="_blank"
          className="px-3 py-2 bg-gray-200 rounded text-sm"
        >
          Deschide
        </a>
      </div>
    </div>
  );
}