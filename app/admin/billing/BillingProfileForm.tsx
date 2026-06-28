"use client";

import { useState } from "react";
import {
  isBillingProfileComplete,
  type BillingType,
  type TenantBillingProfile,
} from "@/lib/billing/billingProfile";
import AdminCard from "../components/AdminCard";
import AdminButton from "../components/AdminButton";
import { AdminInput, AdminLabel, AdminSelect } from "../components/AdminInput";

type Props = {
  initialProfile: TenantBillingProfile | null;
  onCompleteChange?: (complete: boolean) => void;
};

export default function BillingProfileForm({
  initialProfile,
  onCompleteChange,
}: Props) {
  const [type, setType] = useState<BillingType>(
    initialProfile?.type ?? "individual"
  );
  const [name, setName] = useState(initialProfile?.name ?? "");
  const [cui, setCui] = useState(initialProfile?.cui ?? "");
  const [regCom, setRegCom] = useState(initialProfile?.regCom ?? "");
  const [addressLine1, setAddressLine1] = useState(
    initialProfile?.addressLine1 ?? ""
  );
  const [city, setCity] = useState(initialProfile?.city ?? "");
  const [county, setCounty] = useState(initialProfile?.county ?? "");
  const [postalCode, setPostalCode] = useState(initialProfile?.postalCode ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isComplete = isBillingProfileComplete({
    type,
    name: name || null,
    cui: type === "company" ? cui || null : null,
    regCom: type === "company" ? regCom || null : null,
    addressLine1: addressLine1 || null,
    city: city || null,
    county: county || null,
    postalCode: postalCode || null,
    country: "RO",
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/billing/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          name,
          cui,
          regCom,
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

      const saved = data.profile as TenantBillingProfile;
      setMessage("Datele de facturare au fost salvate.");
      onCompleteChange?.(isBillingProfileComplete(saved));
    } catch {
      setError("Eroare de rețea.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminCard className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Date de facturare</h2>
        <p className="text-sm text-white/60 mt-1">
          Obligatorii înainte de plată (card sau transfer bancar). Apare pe
          factura Stripe.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <AdminLabel>Tip client</AdminLabel>
          <AdminSelect
            value={type}
            onChange={(e) => setType(e.target.value as BillingType)}
          >
            <option value="individual">Persoană fizică</option>
            <option value="company">Persoană juridică (firmă)</option>
          </AdminSelect>
        </div>

        <div>
          <AdminLabel>
            {type === "company" ? "Denumire firmă" : "Nume complet"}
          </AdminLabel>
          <AdminInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              type === "company" ? "Ex: SC Salon Style SRL" : "Ex: Ion Popescu"
            }
            required
          />
        </div>

        {type === "company" && (
          <>
            <div>
              <AdminLabel>CUI / CIF</AdminLabel>
              <AdminInput
                value={cui}
                onChange={(e) => setCui(e.target.value)}
                placeholder="Ex: 12345678"
                required
              />
            </div>
            <div>
              <AdminLabel>Nr. Reg. Com. (opțional)</AdminLabel>
              <AdminInput
                value={regCom}
                onChange={(e) => setRegCom(e.target.value)}
                placeholder="Ex: J40/1234/2020"
              />
            </div>
          </>
        )}

        <div>
          <AdminLabel>Adresă (strada, nr.)</AdminLabel>
          <AdminInput
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            placeholder="Ex: Str. Exemplu nr. 10"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <AdminLabel>Localitate</AdminLabel>
            <AdminInput
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
            />
          </div>
          <div>
            <AdminLabel>Județ (opțional)</AdminLabel>
            <AdminInput
              value={county}
              onChange={(e) => setCounty(e.target.value)}
            />
          </div>
        </div>

        <div>
          <AdminLabel>Cod poștal (opțional)</AdminLabel>
          <AdminInput
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
          />
        </div>

        <AdminButton type="submit" size="sm" loading={saving} loadingLabel="Se salvează...">
          Salvează date facturare
        </AdminButton>

        {message && <p className="text-sm text-green-400">{message}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {!isComplete && !message && (
          <p className="text-sm text-yellow-400/90">
            Completează și salvează datele înainte de a alege un plan plătit.
          </p>
        )}
      </form>
    </AdminCard>
  );
}
