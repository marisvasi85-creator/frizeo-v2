"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReviewForm({
  token,
  salonName,
  clientName,
  salonPath,
}: {
  token: string;
  salonName: string;
  clientName: string;
  salonPath: string;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/reviews/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, rating, comment }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Nu am putut salva recenzia.");
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError("Eroare de rețea.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="text-center space-y-4">
        <p className="text-lg font-medium text-green-700">Mulțumim pentru recenzie!</p>
        <a
          href={salonPath}
          className="inline-block bg-black text-white px-5 py-2.5 rounded-xl text-sm"
        >
          Înapoi la salon
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <p className="text-sm text-gray-500">Recenzie pentru</p>
        <h1 className="text-2xl font-semibold mt-1">{salonName}</h1>
        <p className="text-sm text-gray-500 mt-1">Salut, {clientName}</p>
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Nota ta</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              className={`w-11 h-11 rounded-full border text-lg ${
                rating >= n
                  ? "bg-black text-white border-black"
                  : "bg-white text-gray-400 border-gray-200"
              }`}
              aria-label={`${n} stele`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium" htmlFor="comment">
          Comentariu (opțional)
        </label>
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          maxLength={800}
          className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
          placeholder="Cum a fost experiența?"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-black text-white py-3 rounded-xl font-medium disabled:opacity-60"
      >
        {loading ? "Se trimite…" : "Trimite recenzia"}
      </button>
    </form>
  );
}
