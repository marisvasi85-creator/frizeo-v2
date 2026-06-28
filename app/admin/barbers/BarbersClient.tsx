"use client";

import { useEffect, useState } from "react";
import {
  publicBookingPath,
  publicBookingUrl,
} from "@/lib/booking/publicBookingPath";
import AdminCard from "../components/AdminCard";
import AdminButton from "../components/AdminButton";
import EmptyState from "../components/EmptyState";
import { AdminInput } from "../components/AdminInput";

type Barber = {
  id: string;
  display_name: string;
  phone: string | null;
  active: boolean;
  slug?: string | null;
  tenant_id: string;
};

export default function BarbersClient({
  currentPlan,
  activeBarbers,
  pendingInvites,
  maxBarbers,
  canInvite,
  tenantSlug,
}: {
  currentPlan: string;
  activeBarbers: number;
  pendingInvites: number;
  maxBarbers: number | null;
  canInvite: boolean;
  tenantSlug: string;
}) {  
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState(pendingInvites);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";
  async function loadBarbers() {
  const [barbersRes, invitesRes] =
    await Promise.all([
      fetch("/api/barbers"),
      fetch("/api/barbers/invitations"),
    ]);

  const barbersData =
    await barbersRes.json();

  const invitesData =
    await invitesRes.json();
  

  setBarbers(barbersData.barbers || []);
  setInvitations(invitesData.invitations || []);
  setPendingCount(invitesData.invitations?.length ?? 0);
}
useEffect(() => {
  loadBarbers();
}, []);

  async function addBarber() {
  if (!name.trim() || !email.trim()) return;

  setLoading(true);
  setMessage("");

  try {
    const res = await fetch(
      "/api/barbers/invite",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: name,
          email,
          phone,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      setMessage(
        data.error || "Nu s-a putut trimite invitația"
      );
    } else {
      setName("");
      setEmail("");
      setPhone("");

      setMessage(
        "✓ Invitația a fost trimisă. Frizerul va primi un email pentru activarea contului."
      );

      await loadBarbers();
    }
  } catch {
    setMessage("Eroare server");
  }

  setLoading(false);
}

  async function toggleBarber(
    barberId: string,
    active: boolean
  ) {
    const res = await fetch(
      "/api/barbers/toggle",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          barberId,
          active: !active,
        }),
      }
    );

    if (res.ok) {
      loadBarbers();
    } else {
      const data = await res.json();
      alert(data.error || "Nu s-a putut actualiza frizerul.");
    }
  }

  async function deleteBarber(
  barberId: string
) {
  const ok = confirm(
    "Sigur dorești să ștergi acest frizer?"
  );

  if (!ok) return;

  const res = await fetch(
    "/api/barbers/delete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        barberId,
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    alert(data.error);
    return;
  }

  loadBarbers();
}

  const slotsUsed = activeBarbers + pendingCount;
  const maxLabel =
    maxBarbers === null ? "∞" : String(maxBarbers);
  const atLimit = maxBarbers !== null && slotsUsed >= maxBarbers;

  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-2xl font-semibold">
          Frizeri
        </h1>
      <div className="mt-4">
        <AdminCard padding="sm">
  <div className="text-sm text-white/60">
    Plan curent
  </div>

  <div className="font-medium mt-1">
    {currentPlan}
  </div>

  <div className="text-sm text-white/60 mt-3">
    Frizeri activi
  </div>

  <div className="font-medium mt-1">
    {slotsUsed} / {maxLabel}
  </div>

  {pendingCount > 0 && (
    <div className="text-xs text-white/50 mt-1">
      {activeBarbers} activi · {pendingCount} invitații în așteptare
    </div>
  )}

  {atLimit && (
  <AdminButton
    size="sm"
    href="/admin/billing"
    className="inline-block mt-4"
  >
    Upgrade abonament pentru mai mulți frizeri
  </AdminButton>
)}
        </AdminCard>
      </div>
        <p className="text-white/60 mt-1">
          Gestionează frizerii salonului.
        </p>
      </div>

      <AdminCard className="space-y-4">

        <h2 className="font-medium">
          Invită frizer
        </h2>

        {!canInvite ? (
          <p className="text-sm text-white/60">
            Ai atins limita de frizeri pentru planul curent.
            {maxBarbers !== null && maxBarbers <= 1
              ? " Planul Pro permite un singur frizer (proprietarul salonului)."
              : " Upgrade abonamentul pentru a invita mai mulți frizeri."}
          </p>
        ) : (
          <>
        <AdminInput
          placeholder="Nume"
          value={name}
onChange={(e) => {
  setName(e.target.value);
  setMessage("");
}}
        />
        <AdminInput
  placeholder="Email"
  value={email}
  onChange={(e) => {
    setEmail(e.target.value);
    setMessage("");
  }}
/>
        <AdminInput
          placeholder="Telefon"
          value={phone}
onChange={(e) => {
  setPhone(e.target.value);
  setMessage("");
}}
        />

        <AdminButton
  onClick={addBarber}
  disabled={loading || message.startsWith("✓")}
  loading={loading}
  loadingLabel="Se trimite..."
  size="sm"
>
  {message.startsWith("✓")
    ? "Invitație trimisă ✓"
    : "Trimite invitația"}
</AdminButton>

        {message && (
          <div className="text-sm text-white/70">
            {message}
          </div>
        )}
          </>
        )}

      </AdminCard>

      <div className="space-y-3">

        {barbers.length === 0 && (
          <EmptyState className="py-8">Nu există frizeri.</EmptyState>
        )}

        {barbers.map((barber) => (
          <AdminCard
            key={barber.id}
            padding="sm"
            className="flex justify-between items-center"
          >
            <div>

              <div className="font-medium">
                {barber.display_name}
              </div>
              {barber.slug && tenantSlug && (
  <div className="text-xs text-white/40 mt-1">
    {publicBookingPath(tenantSlug, barber.slug)}
  </div>
)}
{barber.slug && tenantSlug && (() => {
  const slug = barber.slug;
  const bookingPath = publicBookingPath(tenantSlug, slug);
  const bookingUrl = publicBookingUrl(tenantSlug, slug, appUrl);

  return (
  <div className="mt-2 space-y-2">

    <div className="text-xs text-white/40 break-all">
  {bookingUrl}
</div>

    <div className="flex gap-2">

      <AdminButton
        variant="secondary"
        size="sm"
        onClick={() =>
          navigator.clipboard.writeText(bookingUrl)
        }
        className="text-xs px-2 py-1"
      >
        Copiază link
      </AdminButton>

      <AdminButton
        variant="secondary"
        size="sm"
        href={bookingPath}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs px-2 py-1"
      >
        Deschide
      </AdminButton>

    </div>

  </div>
  );
})()}
              <div className="text-sm text-white/60">
                {barber.phone || "Fără telefon"}
              </div>

            </div>

            <div className="flex items-center gap-4">

              <div
                className={
                  barber.active
                    ? "text-green-400 text-sm"
                    : "text-red-400 text-sm"
                }
              >
                {barber.active ? "🟢 Activ" : "🔴 Inactiv"}
              </div>

              <button
                onClick={() =>
                  toggleBarber(
                    barber.id,
                    barber.active
                  )
                }
                className="text-sm text-white/70 hover:text-white"
              >
                {barber.active
                  ? "Dezactivează"
                  : "Activează"}
              </button>

              <button
  onClick={() => deleteBarber(barber.id)}
  className="text-sm text-red-400 hover:text-red-300"
>
  Șterge
</button>

            </div>

          </AdminCard>
        ))}

      </div>
<div className="space-y-3 mt-10">

  <h2 className="text-xl font-semibold">
    Invitații trimise
  </h2>

  {invitations.length === 0 && (
    <EmptyState className="py-8">Nu există invitații.</EmptyState>
  )}

  {invitations.map((invite) => (
    <AdminCard key={invite.id} padding="sm">
      <div className="font-medium">
        {invite.full_name}
      </div>

      <div className="text-sm text-white/60">
        {invite.email}
      </div>

      <div className="mt-2">
        {invite.accepted ? (
          <span className="text-green-400 text-sm">
            ✅ Acceptată
          </span>
        ) : (
          <span className="text-yellow-400 text-sm">
            ⏳ În așteptare
          </span>
        )}
      </div>
    </AdminCard>
  ))}
</div>
    </div>
  );
}