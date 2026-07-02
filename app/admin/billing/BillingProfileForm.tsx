"use client";

import { useEffect, useState } from "react";
import AdminButton from "../components/AdminButton";
import { AdminInput, AdminLabel } from "../components/AdminInput";
import AdminCard from "../components/AdminCard";
import type { BillingType } from "@/lib/billing/billingProfile";

type Profile = {
  type: BillingType | null;
  name: string | null;
  cui: string | null;
  regCom: string | null;
  addressLine1: string | null;
  city: string | null;
  county: string | null;
  postalCode: string | null;
  country: string;
};

export default function BillingProfileForm({
  initialComplete,
}: {
  initialComplete: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(initialComplete);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [billingType, setBillingType] = useState<BillingType>("individual");
  const [name, setName] = useState("");
  const [cui, setCui] = useState("");
  const [regCom, setRegCom] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [postalCode, setPostalCode] = useState("");

  useEffect(() => {
    fetch("/api/billing/profile")
      .then((r) => r.json())
      .then((data) => {
        const profile = data.profile as Profile | undefined;
        if (profile) {
          if (profile.type === "company" || profile.type === "individual") {
            setBillingType(profile.type);
          }
          setName(profile.name ?? "");
          setCui(profile.cui ?? "");
          setRegCom(profile.regCom ?? "");
          setAddressLine1(profile.addressLine1 ?? "");
          setCity(profile.city ?? "");
          setCounty(profile.county ?? "");
          setPostalCode(profile.postalCode ?? "");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/billing/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: billingType,
          name,
          cui: billingType === "company" ? cui : undefined,
          regCom: billingType === "company" ? regCom : undefined,
          addressLine1,
          city,
          county,
          postalCode,
          country: "RO",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Nu s-au putut salva datele.");
        return;
      }

      setComplete(true);
      setSuccess(true);
    } catch {
      setError("Eroare de rețea. Încearcă din nou.");
    } finally {
      setSaving(false);
    }
  }

  const isCompany = billingType === "company";

  return (
    <AdminCard>
      <div id="billing-profile-form" className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Date facturare</h2>
          <p className="text-sm text-white/60 mt-1">
            Obligatorii înainte de plată. Folosim aceste date pentru factura fiscală
            emisă după fiecare plată Stripe.
          </p>
        </div>

        {!complete && !loading && (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-yellow-200 text-sm">
            Completează formularul de mai jos ca să poți achiziționa un plan.
          </div>
        )}

        {loading ? (
          <p className="text-sm text-white/50">Se încarcă datele…</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <AdminLabel>Tip facturare</AdminLabel>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setBillingType("individual")}
                  className={`py-2.5 px-3 rounded-lg border text-sm transition ${
                    !isCompany
                      ? "bg-white text-black border-white"
                      : "border-white/20 text-white/70 hover:border-white/40"
                  }`}
                >
                  Persoană fizică
                </button>
                <button
                  type="button"
                  onClick={() => setBillingType("company")}
                  className={`py-2.5 px-3 rounded-lg border text-sm transition ${
                    isCompany
                      ? "bg-white text-black border-white"
                      : "border-white/20 text-white/70 hover:border-white/40"
                  }`}
                >
                  Firmă (PJ)
                </button>
              </div>
            </div>

            <div>
              <AdminLabel>{isCompany ? "Denumire firmă" : "Nume complet"}</AdminLabel>
              <AdminInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  isCompany ? "Ex: Salon Elite SRL" : "Ex: Ion Popescu"
                }
                required
              />
            </div>

            {isCompany && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <AdminLabel>CUI / CIF</AdminLabel>
                  <AdminInput
                    value={cui}
                    onChange={(e) => setCui(e.target.value)}
                    placeholder="Ex: 12345678"
                    required
                  />
                  <p className="text-xs text-white/45 mt-1">Fără prefix RO</p>
                </div>

                <div>
                  <AdminLabel>Nr. Reg. Com. (opțional)</AdminLabel>
                  <AdminInput
                    value={regCom}
                    onChange={(e) => setRegCom(e.target.value)}
                    placeholder="Ex: J40/1234/2020"
                  />
                </div>
              </div>
            )}

            <div>
              <AdminLabel>Adresă</AdminLabel>
              <AdminInput
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="Strada, număr, bloc, apartament"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <AdminLabel>Localitate</AdminLabel>
                <AdminInput
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex: București"
                  required
                />
              </div>

              <div>
                <AdminLabel>Județ</AdminLabel>
                <AdminInput
                  value={county}
                  onChange={(e) => setCounty(e.target.value)}
                  placeholder="Ex: București"
                  required
                />
              </div>
            </div>

            <div>
              <AdminLabel>Cod poștal (opțional)</AdminLabel>
              <AdminInput
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="Ex: 010101"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
            {success && (
              <p className="text-sm text-green-400">
                Datele de facturare au fost salvate.
              </p>
            )}

            <AdminButton type="submit" disabled={saving}>
              {saving ? "Se salvează…" : "Salvează date facturare"}
            </AdminButton>
          </form>
        )}
      </div>
    </AdminCard>
  );
}
