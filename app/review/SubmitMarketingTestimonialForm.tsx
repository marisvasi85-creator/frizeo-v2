"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { MarketingTestimonialUserType } from "@/lib/marketing-testimonials/types";

const inputClassName =
  "w-full bg-frz-fog text-frz-ink placeholder-frz-ink/40 rounded-lg px-4 py-3 outline-none border border-frz-line focus:ring-2 focus:ring-frz-ink/10";

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (rating: number) => void;
}) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          onClick={() => onChange(star)}
          className={`text-2xl transition ${
            star <= value ? "text-amber-500" : "text-frz-ink/20 hover:text-amber-300"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function SubmitMarketingTestimonialForm() {
  const [rating, setRating] = useState(0);
  const [authorName, setAuthorName] = useState("");
  const [salonName, setSalonName] = useState("");
  const [city, setCity] = useState("");
  const [userType, setUserType] = useState<MarketingTestimonialUserType | "">("");
  const [body, setBody] = useState("");
  const [displayConsent, setDisplayConsent] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const photoPreview = useMemo(
    () => (photo ? URL.createObjectURL(photo) : null),
    [photo],
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (rating < 1) {
      setError("Alege un rating între 1 și 5 stele.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("rating", String(rating));
      formData.set("authorName", authorName);
      formData.set("salonName", salonName);
      formData.set("city", city);
      formData.set("userType", userType);
      formData.set("body", body);
      formData.set("displayConsent", displayConsent ? "true" : "false");
      if (photo) formData.set("photo", photo);

      const res = await fetch("/api/marketing-testimonials/submit", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Nu s-a putut trimite recenzia.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Eroare de rețea. Încearcă din nou.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="text-center space-y-4 py-4">
        <div className="text-4xl" aria-hidden>
          ✓
        </div>
        <h2 className="text-xl font-semibold text-frz-ink">Mulțumim!</h2>
        <p className="text-sm text-frz-ink/70">
          Recenzia ta a fost trimisă și va fi verificată înainte de publicare.
        </p>
        <Link
          href="/"
          className="inline-block text-sm font-medium text-frz-ink underline-offset-2 hover:underline"
        >
          Înapoi la pagina principală
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-frz-ink">Rating</label>
        <StarPicker value={rating} onChange={setRating} />
      </div>

      <input
        value={authorName}
        onChange={(e) => setAuthorName(e.target.value)}
        placeholder="Nume"
        autoComplete="name"
        className={inputClassName}
        required
        minLength={2}
      />

      <input
        value={salonName}
        onChange={(e) => setSalonName(e.target.value)}
        placeholder="Salon (opțional)"
        className={inputClassName}
      />

      <input
        value={city}
        onChange={(e) => setCity(e.target.value)}
        placeholder="Oraș (opțional)"
        className={inputClassName}
      />

      <fieldset className="space-y-2 rounded-lg border border-frz-line bg-frz-fog p-3">
        <legend className="px-1 text-sm font-medium text-frz-ink">
          Tip utilizator
        </legend>
        <label className="flex items-center gap-3 text-sm text-frz-ink/70 cursor-pointer">
          <input
            type="radio"
            name="userType"
            checked={userType === "independent"}
            onChange={() => setUserType("independent")}
            className="h-4 w-4 shrink-0"
            required
          />
          Frizer independent
        </label>
        <label className="flex items-center gap-3 text-sm text-frz-ink/70 cursor-pointer">
          <input
            type="radio"
            name="userType"
            checked={userType === "barbershop"}
            onChange={() => setUserType("barbershop")}
            className="h-4 w-4 shrink-0"
          />
          Barbershop
        </label>
      </fieldset>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Recenzia ta"
        className={`${inputClassName} resize-y min-h-[120px]`}
        required
        minLength={10}
        maxLength={2000}
      />

      <div className="space-y-2">
        <label className="text-sm font-medium text-frz-ink">
          Poză (opțional)
        </label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-frz-ink/70 file:mr-3 file:rounded-lg file:border-0 file:bg-frz-ink file:px-3 file:py-2 file:text-sm file:font-medium file:text-frz-ink-contrast"
        />
        {photoPreview && (
          <div className="relative h-32 w-32 overflow-hidden rounded-xl border border-frz-line">
            <Image
              src={photoPreview}
              alt="Previzualizare poză"
              fill
              unoptimized
              className="object-cover"
            />
          </div>
        )}
      </div>

      <label className="flex items-start gap-3 text-sm text-frz-ink/60 cursor-pointer">
        <input
          type="checkbox"
          checked={displayConsent}
          onChange={(e) => setDisplayConsent(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 rounded border-frz-line"
          required
        />
        <span>
          Sunt de acord ca recenzia mea să fie afișată pe site-ul Frizeo.
        </span>
      </label>

      {error && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 text-center"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-frz-ink text-frz-ink-contrast font-semibold py-3 rounded-lg hover:bg-frz-ink-soft transition disabled:opacity-50"
      >
        {loading ? "Se trimite..." : "Trimite recenzia"}
      </button>
    </form>
  );
}
