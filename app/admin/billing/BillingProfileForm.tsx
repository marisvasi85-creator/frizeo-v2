"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BillingType, TenantBillingProfile } from "@/lib/billing/billingProfile";
import AdminCard from "../components/AdminCard";

type Props = {
  initialProfile: TenantBillingProfile;
  complete: boolean;
};

const inputClass =
  "w-full rounded-lg border border-white/10 bg-[#161618] px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20";

export default function BillingProfileForm({ initialProfile, complete }: Props) {
  const router = useRouter();
  const [type, setType] = useState<BillingType>(
    initialProfile.type ?? "individual"
  );
  const [name, setName] = useState(initialProfile.name ?? "");
  const [cui, setCui] = useState(initialProfile.cui ?? "");
  const [regCom, setRegCom] = useState(initialProfile.regCom ?? "");
  const [addressLine1, setAddressLine1] = useState(
    initialProfile.addressLine1 ?? ""
  );
  const [city, setCity] = useState(initialProfile.city ?? "");
  const [county, setCounty] = useState(initialProfile.county ?? "");
  const [postalCode, setPostalCode] = useState(initialProfile.postalCode ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/billing/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          name,
          cui: type === "company" ? cui : undefined,
          regCom: type === "company" ? regCom : undefined,
          addressLine1,
          city,
          county,
          postalCode,
          country: "RO",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Salvarea a eșuat.");
        return;
      }

      setSaved(true);
      router.refresh();
    } catch {
      setError("Eroare de rețea. Încearcă din nou.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminCard>
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Date facturare</h2>
          <p className="text-sm text-white/60 mt-1">
            Necesare pentru factura fiscală SmartBill. Completează înainte de
            prima plată.
          </p>
        </div>

        {!complete && (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-yellow-200 text-sm">
            Completează datele de facturare ca să poți alege un plan plătit.
          </div>
        )}

        {complete && saved && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-green-300 text-sm">
            Datele de facturare au fost salvate.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm text-white/70">Tip client</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="billingType"
                  checked={type === "individual"}
                  onChange={() => setType("individual")}
                />
                Persoană fizică
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="billingType"
                  checked={type === "company"}
                  onChange={() => setType("company")}
                />
                Persoană juridică
              </label>
            </div>
          </fieldset>

          <div>
            <label className="block text-sm text-white/70 mb-1">
              {type === "company" ? "Denumire firmă" : "Nume complet"}
            </label>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {type === "company" && (
            <>
              <div>
                <label className="block text-sm text-white/70 mb-1">
                  CUI / CIF
                </label>
                <input
                  className={inputClass}
                  value={cui}
                  onChange={(e) => setCui(e.target.value)}
                  placeholder="Fără prefix RO"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">
                  Nr. Reg. Com. (opțional)
                </label>
                <input
                  className={inputClass}
                  value={regCom}
                  onChange={(e) => setRegCom(e.target.value)}
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm text-white/70 mb-1">Adresă</label>
            <input
              className={inputClass}
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/70 mb-1">
                Localitate
              </label>
              <input
                className={inputClass}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">
                Județ (opțional)
              </label>
              <input
                className={inputClass}
                value={county}
                onChange={(e) => setCounty(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-1">
              Cod poștal (opțional)
            </label>
            <input
              className={inputClass}
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-white text-black px-4 py-2 text-sm font-medium hover:bg-gray-200 transition disabled:opacity-60"
          >
            {loading ? "Se salvează…" : "Salvează date facturare"}
          </button>
        </form>
      </div>
    </AdminCard>
  );
}
