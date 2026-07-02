"use client";

import { useEffect, useState } from "react";
import AdminButton from "../components/AdminButton";
import { AdminInput, AdminLabel } from "../components/AdminInput";
import AdminCard from "../components/AdminCard";
import type { BillingType } from "@/lib/billing/billingProfile";
import { startStripeCheckout } from "./startCheckout";

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

type SelectedPlan = {
  id: string;
  name: string;
  price: number;
};

export default function BillingProfileForm({
  selectedPlan,
  initialComplete,
  billingComplete,
  onBillingCompleteChange,
  onClearPlan,
}: {
  selectedPlan: SelectedPlan;
  initialComplete: boolean;
  billingComplete: boolean;
  onBillingCompleteChange: (complete: boolean) => void;
  onClearPlan: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
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
    setPayError(null);

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

      onBillingCompleteChange(true);
      setSuccess(true);
    } catch {
      setError("Eroare de rețea. Încearcă din nou.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePay() {
    if (!billingComplete && !initialComplete) {
      setPayError("Salvează datele de facturare înainte de plată.");
      return;
    }

    setPaying(true);
    setPayError(null);

    try {
      const result = await startStripeCheckout({
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        planPrice: selectedPlan.price,
      });

      if (!result.ok) {
        setPayError(result.error);
        return;
      }

      if ("url" in result && result.url) {
        window.location.href = result.url;
        return;
      }

      if ("success" in result && result.success) {
        window.location.href = "/admin/billing?checkout=success&updated=1";
      }
    } catch {
      setPayError("Eroare de rețea. Încearcă din nou.");
    } finally {
      setPaying(false);
    }
  }

  const isCompany = billingType === "company";
  const canPay = billingComplete || initialComplete;

  return (
    <AdminCard>
      <div id="billing-profile-form" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-blue-300">
              Pas 2 · Date facturare
            </p>
            <h2 className="text-xl font-semibold mt-1">
              Plan selectat: {selectedPlan.name}
            </h2>
            <p className="text-sm text-white/60 mt-1">
              Completează datele pentru factura fiscală, apoi continuă la plată.
              Factura va fi trimisă pe email după încasare.
            </p>
          </div>

          <button
            type="button"
            onClick={onClearPlan}
            className="text-sm text-white/50 hover:text-white/80"
          >
            Schimbă planul
          </button>
        </div>

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

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <AdminButton type="submit" disabled={saving || paying}>
                {saving ? "Se salvează…" : "Salvează date facturare"}
              </AdminButton>

              <AdminButton
                type="button"
                disabled={!canPay || paying || saving}
                onClick={handlePay}
              >
                {paying ? "Se deschide Stripe…" : "Continuă la plată"}
              </AdminButton>
            </div>

            {payError && <p className="text-sm text-red-400">{payError}</p>}

            {!canPay && (
              <p className="text-xs text-white/50">
                Salvează datele de facturare pentru a continua la plată.
              </p>
            )}
          </form>
        )}
      </div>
    </AdminCard>
  );
}
