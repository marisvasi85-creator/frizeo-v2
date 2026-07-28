"use client";

import { useState } from "react";
import {
  publicBookingPath,
  publicBookingUrl,
  stableBookingPath,
  stableBookingUrl,
} from "@/lib/booking/publicBookingPath";
import AdminCard from "../components/AdminCard";
import AdminButton from "../components/AdminButton";
import { useSavedFeedback } from "../components/useSavedFeedback";
import EmptyState from "../components/EmptyState";
import { AdminInput } from "../components/AdminInput";

type Barber = {
  id: string;
  display_name: string;
  phone: string | null;
  active: boolean;
  slug?: string | null;
  tenant_id: string;
  user_id?: string | null;
};

type Invitation = {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  accepted?: boolean;
  created_at?: string;
};

export default function BarbersClient({
  currentPlan,
  activeBarbers: initialActiveBarbers,
  pendingInvites,
  maxBarbers,
  isOverLimit: initialIsOverLimit,
  ownerUserId,
  ownerActsAsBarber: initialOwnerActsAsBarber,
  tenantSlug,
  appUrl,
  initialBarbers = [],
  initialInvitations = [],
}: {
  currentPlan: string;
  activeBarbers: number;
  pendingInvites: number;
  maxBarbers: number | null;
  isOverLimit: boolean;
  ownerUserId: string;
  ownerActsAsBarber: boolean;
  tenantSlug: string;
  appUrl: string;
  initialBarbers?: Barber[];
  initialInvitations?: Invitation[];
}) {
  const [barbers, setBarbers] = useState<Barber[]>(initialBarbers);
  const [invitations, setInvitations] = useState<Invitation[]>(
    initialInvitations,
  );
  const [pendingCount, setPendingCount] = useState(pendingInvites);
  const [activeCount, setActiveCount] = useState(initialActiveBarbers);
  const [ownerActsAsBarber, setOwnerActsAsBarber] = useState(
    initialOwnerActsAsBarber,
  );
  const [ownerRoleLoading, setOwnerRoleLoading] = useState(false);
  const [ownerRoleMessage, setOwnerRoleMessage] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const {
    saved: inviteSaved,
    markSaved: markInviteSaved,
    clearSaved: clearInviteSaved,
  } = useSavedFeedback();

  async function loadBarbers() {
    const [barbersRes, invitesRes] = await Promise.all([
      fetch("/api/barbers"),
      fetch("/api/barbers/invitations"),
    ]);

    const barbersData = await barbersRes.json();
    const invitesData = await invitesRes.json();
    const nextBarbers: Barber[] = barbersData.barbers || [];

    setBarbers(nextBarbers);
    setInvitations(invitesData.invitations || []);
    setPendingCount(invitesData.invitations?.length ?? 0);
    setActiveCount(nextBarbers.filter((b) => b.active).length);
    const ownerRow = nextBarbers.find((b) => b.user_id === ownerUserId);
    if (ownerRow) {
      setOwnerActsAsBarber(Boolean(ownerRow.active));
    }
  }

  async function addBarber() {
    if (!name.trim() || !email.trim()) return;

    setLoading(true);
    setMessage("");
    clearInviteSaved();

    try {
      const res = await fetch("/api/barbers/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: name,
          email,
          phone,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Nu s-a putut trimite invitația");
      } else {
        setName("");
        setEmail("");
        setPhone("");

        markInviteSaved();
        setMessage(
          "Invitația a fost trimisă. Frizerul va primi un email pentru activarea contului. Poate fi activat doar dacă ai un loc liber în plan.",
        );

        await loadBarbers();
      }
    } catch {
      setMessage("Eroare server");
    }

    setLoading(false);
  }

  async function toggleOwnerRole(enable: boolean) {
    setOwnerRoleLoading(true);
    setOwnerRoleMessage("");

    try {
      const res = await fetch("/api/barbers/owner-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enable }),
      });
      const data = await res.json();

      if (!res.ok) {
        setOwnerRoleMessage(
          data.error || "Nu s-a putut actualiza opțiunea „Sunt și frizer”.",
        );
      } else {
        setOwnerActsAsBarber(Boolean(data.active));
        setOwnerRoleMessage(data.message || "Salvat.");
        await loadBarbers();
      }
    } catch {
      setOwnerRoleMessage("Eroare server");
    }

    setOwnerRoleLoading(false);
  }

  async function toggleBarber(barberId: string, active: boolean) {
    const res = await fetch("/api/barbers/toggle", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        barberId,
        active: !active,
      }),
    });

    if (res.ok) {
      loadBarbers();
    } else {
      const data = await res.json();
      alert(data.error || "Nu s-a putut actualiza frizerul.");
    }
  }

  async function deleteBarber(barberId: string) {
    const ok = confirm("Sigur dorești să ștergi acest frizer?");

    if (!ok) return;

    const res = await fetch("/api/barbers/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        barberId,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error);
      return;
    }

    loadBarbers();
  }

  async function deleteInvitation(invite: {
    id: string;
    full_name: string;
    email: string;
  }) {
    const ok = confirm(
      `Ștergi invitația pentru ${invite.full_name} (${invite.email})?`,
    );

    if (!ok) return;

    const res = await fetch("/api/barbers/invitations/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitationId: invite.id }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Nu s-a putut șterge invitația");
      return;
    }

    await loadBarbers();
  }

  const maxLabel = maxBarbers === null ? "∞" : String(maxBarbers);
  const atActiveLimit =
    maxBarbers !== null && activeCount >= maxBarbers;
  const isOverLimit =
    maxBarbers !== null
      ? activeCount > maxBarbers
      : initialIsOverLimit;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Frizeri</h1>
        <div className="mt-4">
          <AdminCard padding="sm">
            <div className="text-sm text-white/60">Plan curent</div>

            <div className="font-medium mt-1">{currentPlan}</div>

            <div className="text-sm text-white/60 mt-3">Frizeri activi</div>

            <div className="font-medium mt-1">
              {activeCount} / {maxLabel}
            </div>

            {pendingCount > 0 && (
              <div className="text-xs text-white/50 mt-1">
                {pendingCount} invitații în așteptare (nu ocupă locuri până la
                acceptare)
              </div>
            )}

            {isOverLimit && (
              <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                Ai mai mulți frizeri activi decât permite planul. Dezactivează
                frizeri până la {maxLabel} ca să poți schimba planul sau activa
                alții.
              </div>
            )}

            {atActiveLimit && !isOverLimit && (
              <AdminButton
                size="sm"
                href="/admin/billing"
                className="inline-block mt-4"
              >
                Upgrade pentru mai mulți frizeri activi
              </AdminButton>
            )}
          </AdminCard>
        </div>
        <p className="text-white/60 mt-1">
          Gestionează frizerii salonului. Invitațiile sunt nelimitate — doar
          frizerii activi consumă locuri din plan.
        </p>
      </div>

      <AdminCard className="space-y-4">
        <h2 className="font-medium">Sunt și frizer</h2>
        <p className="text-sm text-white/60">
          Ca owner poți fi doar administrator, sau administrator + frizer. Dacă
          ești frizer, ocupi unul dintre locurile active ale planului.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <span
            className={
              ownerActsAsBarber ? "text-green-400 text-sm" : "text-white/60 text-sm"
            }
          >
            {ownerActsAsBarber
              ? "Activ: administrator + frizer"
              : "Doar administrator"}
          </span>

          <AdminButton
            size="sm"
            variant="secondary"
            disabled={ownerRoleLoading}
            loading={ownerRoleLoading}
            loadingLabel="Se salvează…"
            onClick={() => toggleOwnerRole(!ownerActsAsBarber)}
          >
            {ownerActsAsBarber
              ? "Treci pe doar administrator"
              : "Activează-mă ca frizer"}
          </AdminButton>
        </div>

        {ownerRoleMessage && (
          <p className="text-sm text-white/70">{ownerRoleMessage}</p>
        )}
      </AdminCard>

      <AdminCard className="space-y-4">
        <h2 className="font-medium">Invită frizer</h2>

        <p className="text-sm text-white/60">
          Poți invita oricâți frizeri. Acceptarea / activarea e posibilă doar
          dacă ai loc liber
          {maxBarbers !== null ? ` (maxim ${maxBarbers} activi)` : ""}.
        </p>

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
          disabled={loading || inviteSaved}
          loading={loading}
          loadingLabel="Se trimite..."
          saved={inviteSaved}
          savedLabel="Trimis ✔"
          size="sm"
        >
          Trimite invitația
        </AdminButton>

        {message && <div className="text-sm text-white/70">{message}</div>}
      </AdminCard>

      <div className="space-y-3">
        {barbers.length === 0 && (
          <EmptyState className="py-8">Nu există frizeri.</EmptyState>
        )}

        {barbers.map((barber) => {
          const isOwner = barber.user_id === ownerUserId;

          return (
            <AdminCard
              key={barber.id}
              padding="sm"
              className="flex justify-between items-center"
            >
              <div>
                <div className="font-medium">
                  {barber.display_name}
                  {isOwner && (
                    <span className="ml-2 text-xs text-white/40">
                      (tu · owner)
                    </span>
                  )}
                </div>
                {barber.slug && tenantSlug && (
                  <div className="text-xs text-white/40 mt-1">
                    {publicBookingPath(tenantSlug, barber.slug)}
                  </div>
                )}
                {tenantSlug &&
                  (() => {
                    const slug = barber.slug;
                    const stablePath = stableBookingPath(barber.id);
                    const stableUrl = stableBookingUrl(barber.id, appUrl);
                    const bookingPath = slug
                      ? publicBookingPath(tenantSlug, slug)
                      : stablePath;
                    const bookingUrl = slug
                      ? publicBookingUrl(tenantSlug, slug, appUrl)
                      : stableUrl;

                    return (
                      <div className="mt-2 space-y-2">
                        <div className="text-xs text-white/40 break-all">
                          Permanent: {stableUrl}
                        </div>

                        {slug && (
                          <div className="text-xs text-white/30 break-all">
                            Scurt: {bookingUrl}
                          </div>
                        )}

                        <div className="flex gap-2">
                          <AdminButton
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              navigator.clipboard.writeText(stableUrl)
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
                  {barber.active ? "Activ" : "Inactiv"}
                </div>

                <button
                  onClick={() => toggleBarber(barber.id, barber.active)}
                  className="text-sm text-white/70 hover:text-white"
                >
                  {barber.active ? "Dezactivează" : "Activează"}
                </button>

                {!isOwner && (
                  <button
                    onClick={() => deleteBarber(barber.id)}
                    className="text-sm text-red-400 hover:text-red-300"
                  >
                    Șterge
                  </button>
                )}
              </div>
            </AdminCard>
          );
        })}
      </div>
      <div className="space-y-3 mt-10">
        <h2 className="text-xl font-semibold">Invitații trimise</h2>

        {invitations.length === 0 && (
          <EmptyState className="py-8">Nu există invitații.</EmptyState>
        )}

        {invitations.map((invite) => (
          <AdminCard
            key={invite.id}
            padding="sm"
            className="flex justify-between items-center gap-3"
          >
            <div>
              <div className="font-medium">{invite.full_name}</div>

              <div className="text-sm text-white/60">{invite.email}</div>

              <div className="mt-2">
                <span className="text-yellow-400 text-sm">În așteptare</span>
              </div>
            </div>

            <AdminButton
              variant="danger"
              size="sm"
              onClick={() => deleteInvitation(invite)}
              className="shrink-0"
            >
              Șterge
            </AdminButton>
          </AdminCard>
        ))}
      </div>
    </div>
  );
}
