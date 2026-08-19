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
  planSlug,
  invitesAllowed,
  isTrial = false,
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
  planSlug: string | null;
  invitesAllowed: boolean;
  isTrial?: boolean;
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

    if (isTrial) {
      const ok = confirm(
        "Important (trial):\n\nFrizerul invitat face parte din abonamentul salonului.\n\n• Dacă după trial alegi Pro+ / Custom, rămâne acoperit din planul salonului.\n• Dacă alegi Pro (1 frizer) sau Free, frizerii în plus trebuie dezactivați — nu rămân activi pe plan inferior.\n\nTrimiți invitația?",
      );
      if (!ok) return;
    }

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
          isTrial
            ? "Invitația a fost trimisă. Important: invitatul e acoperit din abonamentul salonului. Dacă după trial alegi Pro (1 frizer), frizerii în plus vor trebui dezactivați. Invitația expiră în 7 zile."
            : "Invitația a fost trimisă. Frizerul va primi un email pentru activarea contului. Invitația ocupă un loc din plan până la acceptare, ștergere sau expirare (7 zile).",
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
        // Meniul (Profil / Servicii / Program) depinde de rol — reload complet.
        window.location.href = "/admin/barbers";
        return;
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
  const inviteSlotsUsed = activeCount + pendingCount;
  const invitesLeft = !invitesAllowed
    ? 0
    : maxBarbers === null
      ? null
      : Math.max(0, maxBarbers - inviteSlotsUsed);
  const atInviteLimit =
    invitesAllowed && maxBarbers !== null && invitesLeft === 0;
  const invitesBlockedByPlan = !invitesAllowed;
  const atActiveLimit =
    maxBarbers !== null && activeCount >= maxBarbers;
  const isOverLimit =
    maxBarbers !== null
      ? activeCount > maxBarbers
      : initialIsOverLimit;
  const inviteQuotaHint = invitesBlockedByPlan
    ? "Planul Free/Pro nu include invitații pentru echipă — un singur frizer. Pentru invitații: Pro+ sau Custom."
    : maxBarbers === null
      ? "Plan Custom: invitații în funcție de locurile configurate."
      : ownerActsAsBarber
        ? `Ești și frizer (ocupi 1 loc). Mai poți invita maxim ${Math.max(0, maxBarbers - 1)} frizeri pe acest plan.`
        : `Poți invita până la ${maxBarbers} frizeri pe acest plan.`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Frizeri</h1>
        <div className="mt-4">
          <AdminCard padding="sm">
            <div className="text-sm text-frz-ink/60">Plan curent</div>

            <div className="font-medium mt-1">{currentPlan}</div>

            <div className="text-sm text-frz-ink/60 mt-3">Frizeri activi</div>

            <div className="font-medium mt-1">
              {activeCount} / {maxLabel}
            </div>

            {invitesAllowed && pendingCount > 0 && (
              <div className="text-xs text-frz-ink/50 mt-1">
                {pendingCount} invitații în așteptare (ocupă locuri până la
                acceptare sau ștergere)
              </div>
            )}

            {invitesAllowed && maxBarbers !== null && (
              <div className="text-xs text-frz-ink/50 mt-1">
                Locuri pentru invitații noi:{" "}
                {invitesLeft === null ? "∞" : invitesLeft} rămase (
                {inviteSlotsUsed}/{maxBarbers} ocupate)
              </div>
            )}

            {invitesBlockedByPlan && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                Planul {planSlug === "pro" ? "Pro" : "Free"} nu include
                invitații. Un singur frizer. Pentru echipă: upgrade la Pro+ sau
                Custom.
              </div>
            )}

            {isOverLimit && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                Ai mai mulți frizeri activi decât permite planul. Dezactivează
                frizeri până la {maxLabel} ca să poți schimba planul sau activa
                alții.
              </div>
            )}

            {atInviteLimit && !isOverLimit && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                Ai atins limita de {maxLabel} frizeri (activi + invitații).
                Dezactivează un frizer, șterge o invitație în așteptare, sau fă
                upgrade la Custom.
              </div>
            )}

            {(invitesBlockedByPlan || atActiveLimit || atInviteLimit) &&
              !isOverLimit && (
              <AdminButton
                size="sm"
                href="/admin/billing"
                className="inline-block mt-4"
              >
                {invitesBlockedByPlan
                  ? "Upgrade la Pro+ sau Custom"
                  : "Upgrade la Custom pentru mai mulți frizeri"}
              </AdminButton>
            )}
          </AdminCard>
        </div>
        <p className="text-frz-ink/60 mt-1">
          Gestionează frizerii salonului. {inviteQuotaHint}
        </p>
      </div>

      <AdminCard className="space-y-4">
        <h2 className="font-medium">Invită frizer</h2>

        <p className="text-sm text-frz-ink/60">
          {invitesBlockedByPlan
            ? "Planul Free/Pro nu include invitații. Un singur frizer — fără echipă prin invitații. Upgrade la Pro+ sau Custom."
            : maxBarbers === null
              ? "Poți invita frizeri conform locurilor din planul Custom. Invitațiile expiră în 7 zile."
              : ownerActsAsBarber
                ? `Pe planul curent ai maxim ${maxBarbers} locuri. Tu ocupi 1 ca frizer — mai poți invita ${Math.max(0, maxBarbers - 1)} (dacă ai locuri libere). Invitațiile expiră în 7 zile.`
                : `Pe planul curent poți invita până la ${maxBarbers} frizeri. Invitațiile expiră în 7 zile.`}
        </p>

        {isTrial && invitesAllowed && !atInviteLimit && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 space-y-2">
            <p className="font-medium text-amber-800">Important pe trial</p>
            <p>
              Frizerul invitat face parte din abonamentul salonului. Nu e taxat
              separat — e acoperit din planul tău (Pro+ pe trial).
            </p>
            <p>
              Dacă după trial alegi un plan inferior (
              <span className="font-medium">Pro</span> = 1 frizer, sau Free),
              frizerii în plus trebuie dezactivați. Nu rămân activi pe Pro.
            </p>
            <p>
              Dacă alegi Pro+ sau Custom, echipa rămâne activă în limita
              locurilor planului.
            </p>
          </div>
        )}

        {(invitesBlockedByPlan || atInviteLimit) && (
          <p className="text-sm text-amber-700">
            {invitesBlockedByPlan
              ? "Invitațiile sunt disponibile pe Pro+ (trial inclus) și Custom."
              : "Ai atins limita. Dezactivează un frizer actual, șterge o invitație în așteptare, sau upgrade la Custom."}
          </p>
        )}

        <AdminInput
          placeholder="Nume"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setMessage("");
          }}
          disabled={invitesBlockedByPlan || atInviteLimit}
        />
        <AdminInput
          placeholder="Email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setMessage("");
          }}
          disabled={invitesBlockedByPlan || atInviteLimit}
        />
        <AdminInput
          placeholder="Telefon"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setMessage("");
          }}
          disabled={invitesBlockedByPlan || atInviteLimit}
        />

        <AdminButton
          onClick={addBarber}
          disabled={
            loading || inviteSaved || invitesBlockedByPlan || atInviteLimit
          }
          loading={loading}
          loadingLabel="Se trimite..."
          saved={inviteSaved}
          savedLabel="Trimis ✔"
          size="sm"
        >
          Trimite invitația
        </AdminButton>

        {message && <div className="text-sm text-frz-ink/70">{message}</div>}
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
                    <span className="ml-2 text-xs text-frz-ink/40">
                      (tu · owner)
                    </span>
                  )}
                </div>
                {barber.slug && tenantSlug && (
                  <div className="text-xs text-frz-ink/40 mt-1">
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
                        <div className="text-xs text-frz-ink/40 break-all">
                          Permanent: {stableUrl}
                        </div>

                        {slug && (
                          <div className="text-xs text-frz-ink/30 break-all">
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
                <div className="text-sm text-frz-ink/60">
                  {barber.phone || "Fără telefon"}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div
                  className={
                    barber.active
                      ? "text-emerald-600 text-sm"
                      : "text-red-600 text-sm"
                  }
                >
                  {barber.active ? "Activ" : "Inactiv"}
                </div>

                <button
                  onClick={() => toggleBarber(barber.id, barber.active)}
                  className="text-sm text-frz-ink/70 hover:text-frz-ink"
                >
                  {barber.active ? "Dezactivează" : "Activează"}
                </button>

                {!isOwner && (
                  <button
                    onClick={() => deleteBarber(barber.id)}
                    className="text-sm text-red-600 hover:text-red-500"
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

              <div className="text-sm text-frz-ink/60">{invite.email}</div>

              <div className="mt-2">
                <span className="text-amber-600 text-sm">În așteptare</span>
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

      <AdminCard id="owner-role" className="space-y-3 scroll-mt-24 mt-10">
        <h2 className="font-medium text-frz-ink/80 text-sm">
          Opțiune: apari și ca frizer
        </h2>
        <p className="text-sm text-frz-ink/45">
          Schimbi rar. Dacă ești și frizer, ocupi 1 loc și ai Profil, Servicii și
          Program în meniu.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-frz-ink/45">
            {ownerActsAsBarber
              ? "Activă — ești și frizer"
              : "Dezactivată — doar admin"}
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
              ? "Dezactivează rolul de frizer"
              : "Activează rolul de frizer"}
          </AdminButton>
        </div>

        {ownerRoleMessage && (
          <p className="text-sm text-frz-ink/70">{ownerRoleMessage}</p>
        )}
      </AdminCard>
    </div>
  );
}
