"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminButton from "../components/AdminButton";
import AdminCard from "../components/AdminCard";
import EmptyState from "../components/EmptyState";
import {
  AdminBadge,
  AdminInput,
  AdminLabel,
  AdminSelect,
} from "../components/AdminInput";
import {
  BOOKING_ACCESS_LABELS,
  type BookingAccessMode,
  type ClientAccessStatus,
} from "@/lib/barber-access/types";

type Barber = {
  id: string;
  display_name: string | null;
  booking_access_mode: BookingAccessMode;
};

type AccessDetails = {
  id: string;
  status: ClientAccessStatus;
  source: string;
  requested_at: string;
  referral: string | null;
  request_message: string | null;
};

type ClientRow = {
  phone_normalized: string;
  client_name: string | null;
  client_email: string | null;
  appointment_count: number;
  last_appointment: string | null;
  cancellation_count: number;
  no_show_count: number;
  access: AccessDetails | null;
};

type ClientAction =
  | "approve"
  | "bulk_approve"
  | "approve_all_existing"
  | "reject"
  | "revoke"
  | "block"
  | "unblock"
  | "reopen";

type Feedback = { tone: "success" | "error"; message: string } | null;

const FILTERS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Toți" },
  { value: "pending", label: "În așteptare" },
  { value: "approved", label: "Acceptați" },
  { value: "rejected", label: "Respinși" },
  { value: "blocked", label: "Blocați" },
  { value: "existing", label: "Clienți existenți" },
];

const STATUS_LABELS: Record<ClientAccessStatus, string> = {
  pending: "În așteptare",
  approved: "Acceptat",
  rejected: "Respins",
  blocked: "Blocat",
};

function displayPhone(normalized: string) {
  return normalized.startsWith("40") ? `+${normalized}` : normalized;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export default function ClientAccessClient({
  initialBarberId,
  initialStatus,
}: {
  initialBarberId: string;
  initialStatus: string;
}) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [selectedBarberId, setSelectedBarberId] = useState("");
  const [mode, setMode] = useState<BookingAccessMode>("open");
  const [schemaReady, setSchemaReady] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [filter, setFilter] = useState(() =>
    FILTERS.some((item) => item.value === initialStatus) ? initialStatus : "all",
  );
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());
  const [savingMode, setSavingMode] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const existingClientsRef = useRef<HTMLDivElement>(null);
  const clientsRequestId = useRef(0);

  const selectedBarber = useMemo(
    () => barbers.find((barber) => barber.id === selectedBarberId) ?? null,
    [barbers, selectedBarberId],
  );

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const response = await fetch("/api/barber-access/settings");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Nu am putut încărca setările.");

      const nextBarbers = (data.barbers ?? []) as Barber[];
      const requestedBarber = nextBarbers.find(
        (barber) => barber.id === initialBarberId,
      );
      const firstBarber = requestedBarber ?? nextBarbers[0];
      setBarbers(nextBarbers);
      setSchemaReady(data.schemaReady !== false);
      setSelectedBarberId((current) => current || firstBarber?.id || "");
      if (firstBarber) {
        setMode(firstBarber.booking_access_mode);
      }
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Nu am putut încărca setările.",
      });
    } finally {
      setSettingsLoading(false);
    }
  }, [initialBarberId]);

  const loadClients = useCallback(async () => {
    if (!selectedBarberId || !schemaReady) return;
    const requestId = ++clientsRequestId.current;
    setClientsLoading(true);
    try {
      const params = new URLSearchParams({
        barberId: selectedBarberId,
        status: filter,
      });
      if (debouncedSearch) params.set("q", debouncedSearch);

      const response = await fetch(`/api/barber-access/clients?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Nu am putut încărca lista.");

      if (requestId === clientsRequestId.current) {
        setClients((data.clients ?? []) as ClientRow[]);
        setSelectedPhones(new Set());
      }
    } catch (error) {
      if (requestId === clientsRequestId.current) {
        setFeedback({
          tone: "error",
          message: error instanceof Error ? error.message : "Nu am putut încărca lista.",
        });
      }
    } finally {
      if (requestId === clientsRequestId.current) {
        setClientsLoading(false);
      }
    }
  }, [debouncedSearch, filter, schemaReady, selectedBarberId]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 5000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  async function saveMode() {
    if (!selectedBarberId || !selectedBarber) return;
    setSavingMode(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/barber-access/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barberId: selectedBarberId, mode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Nu am putut salva setarea.");

      setBarbers((current) =>
        current.map((barber) =>
          barber.id === selectedBarberId
            ? { ...barber, booking_access_mode: mode }
            : barber,
        ),
      );
      const approvedExistingCount = Number(data.approvedExistingCount ?? 0);
      setFeedback({
        tone: "success",
        message:
          approvedExistingCount > 0
            ? `Modul de acces a fost salvat. ${approvedExistingCount} ${approvedExistingCount === 1 ? "client existent a fost acceptat automat" : "clienți existenți au fost acceptați automat"}.`
            : "Modul de acces a fost salvat.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Nu am putut salva setarea.",
      });
    } finally {
      setSavingMode(false);
    }
  }

  async function runAction(
    action: ClientAction,
    phones: string[],
    confirmation?: string,
  ) {
    if (!selectedBarberId) return;
    if (confirmation && !window.confirm(confirmation)) return;

    setActionLoading(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/barber-access/clients/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barberId: selectedBarberId, action, phones }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Acțiunea nu a putut fi aplicată.");

      setFeedback({
        tone: "success",
        message: `Actualizare aplicată pentru ${data.affected} ${data.affected === 1 ? "client" : "clienți"}.${data.skippedBlocked ? ` ${data.skippedBlocked} ${data.skippedBlocked === 1 ? "client blocat a fost păstrat" : "clienți blocați au fost păstrați"}.` : ""}`,
      });
      await loadClients();
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Acțiunea nu a putut fi aplicată.",
      });
    } finally {
      setActionLoading(false);
    }
  }

  function togglePhone(phone: string) {
    setSelectedPhones((current) => {
      const next = new Set(current);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  }

  function toggleAll() {
    setSelectedPhones((current) =>
      current.size === clients.length
        ? new Set()
        : new Set(clients.map((client) => client.phone_normalized)),
    );
  }

  if (settingsLoading) {
    return <p className="text-sm text-frz-muted">Se încarcă accesul la programări...</p>;
  }

  if (!schemaReady) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-semibold">Acces la programări</h1>
        <AdminCard>
          <h2 className="font-semibold">Funcționalitatea este pregătită în cod</h2>
          <p className="mt-2 text-sm text-frz-muted">
            Migrarea Supabase nu a fost aplicată încă. Până atunci, toți frizerii
            rămân în modul „Programări deschise”, fără schimbări în fluxul actual.
          </p>
        </AdminCard>
      </div>
    );
  }

  if (barbers.length === 0) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-semibold">Acces la programări</h1>
        <EmptyState>Nu există niciun frizer activ de administrat.</EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          role={feedback.tone === "error" ? "alert" : "status"}
          className={`fixed right-4 top-4 z-50 max-w-sm rounded-xl border px-4 py-3 text-sm shadow-lg ${
            feedback.tone === "success"
              ? "border-emerald-500/40 bg-frz-card text-frz-ink"
              : "border-frz-danger/40 bg-frz-card text-frz-danger"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-semibold">Acces la programări</h1>
        <p className="mt-1 text-sm text-frz-muted">
          Controlează separat cine se poate programa la fiecare frizer.
        </p>
      </div>

      <AdminCard>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <AdminLabel>Frizer</AdminLabel>
            <AdminSelect
              value={selectedBarberId}
              onChange={(event) => {
                const nextId = event.target.value;
                setSelectedBarberId(nextId);
                const nextBarber = barbers.find((barber) => barber.id === nextId);
                if (nextBarber) setMode(nextBarber.booking_access_mode);
              }}
            >
              {barbers.map((barber) => (
                <option key={barber.id} value={barber.id}>
                  {barber.display_name || "Frizer"}
                </option>
              ))}
            </AdminSelect>
          </div>
          <div>
            <AdminLabel>Mod de acces</AdminLabel>
            <div className="flex flex-col gap-2 sm:flex-row">
              <AdminSelect
                value={mode}
                onChange={(event) => setMode(event.target.value as BookingAccessMode)}
              >
                {Object.entries(BOOKING_ACCESS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </AdminSelect>
              <AdminButton
                onClick={saveMode}
                loading={savingMode}
                disabled={mode === selectedBarber?.booking_access_mode}
                className="shrink-0"
              >
                Salvează
              </AdminButton>
            </div>
          </div>
        </div>
        <p className="mt-4 text-sm text-frz-muted">
          {mode === "open"
            ? "Orice client se poate programa folosind fluxul public actual."
            : mode === "approval_required"
              ? "Clienții noi trimit o solicitare și se pot programa numai după aprobare."
              : "Numai clienții acceptați anterior se pot programa; solicitările noi sunt închise."}
        </p>
      </AdminCard>

      <div ref={existingClientsRef} className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <AdminLabel htmlFor="client-access-search">Caută client</AdminLabel>
            <AdminInput
              id="client-access-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nume, telefon sau e-mail"
            />
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Filtre status">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={filter === item.value}
                onClick={() => setFilter(item.value)}
                className={`rounded-xl border px-3 py-2 text-sm transition ${
                  filter === item.value
                    ? "border-frz-ink bg-frz-ink text-frz-ink-contrast"
                    : "border-frz-line bg-frz-card text-frz-muted hover:bg-frz-fog"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {clients.length > 0 && (
          <AdminCard padding="sm" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={selectedPhones.size === clients.length && clients.length > 0}
                onChange={toggleAll}
                className="h-5 w-5"
              />
              {selectedPhones.size > 0
                ? `${selectedPhones.size} clienți selectați`
                : "Selectează toate rezultatele"}
            </label>
            <AdminButton
              size="sm"
              disabled={selectedPhones.size === 0}
              loading={actionLoading}
              onClick={() =>
                void runAction(
                  "bulk_approve",
                  [...selectedPhones],
                  `Accepți accesul la programări pentru ${selectedPhones.size} clienți selectați?`,
                )
              }
            >
              Acceptă clienții selectați
            </AdminButton>
          </AdminCard>
        )}

        {clientsLoading ? (
          <p className="py-10 text-center text-sm text-frz-muted">Se încarcă clienții...</p>
        ) : clients.length === 0 ? (
          <EmptyState>
            {search || filter !== "all"
              ? "Nu există clienți pentru filtrul ales."
              : "Nu există încă programări sau solicitări pentru acest frizer."}
          </EmptyState>
        ) : (
          <div className="grid gap-3">
            {clients.map((client) => (
              <ClientAccessRow
                key={client.phone_normalized}
                client={client}
                selected={selectedPhones.has(client.phone_normalized)}
                disabled={actionLoading}
                onToggle={() => togglePhone(client.phone_normalized)}
                onAction={(action, confirmation) =>
                  void runAction(action, [client.phone_normalized], confirmation)
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ClientAccessRow({
  client,
  selected,
  disabled,
  onToggle,
  onAction,
}: {
  client: ClientRow;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
  onAction: (action: ClientAction, confirmation?: string) => void;
}) {
  const status = client.access?.status;
  const name = client.client_name || "Client fără nume";

  return (
    <AdminCard padding="sm">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Selectează ${name}`}
          className="mt-1 h-5 w-5 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{name}</h3>
                {status ? (
                  <AdminBadge
                    tone={
                      status === "approved"
                        ? "success"
                        : status === "pending"
                          ? "warning"
                          : status === "blocked"
                            ? "danger"
                            : "neutral"
                    }
                  >
                    {STATUS_LABELS[status]}
                  </AdminBadge>
                ) : (
                  <AdminBadge>Neacceptat</AdminBadge>
                )}
              </div>
              <p className="mt-1 break-words text-sm text-frz-muted">
                {displayPhone(client.phone_normalized)}
                {client.client_email ? ` · ${client.client_email}` : ""}
              </p>
              <p className="mt-2 text-xs text-frz-muted">
                {client.appointment_count} programări · ultima {formatDate(client.last_appointment)} · {client.cancellation_count} anulări · {client.no_show_count} neprezentări
              </p>
              {client.access?.referral && (
                <p className="mt-2 text-sm text-frz-muted">
                  Recomandare: {client.access.referral}
                </p>
              )}
              {client.access?.request_message && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-frz-muted">
                  Mesaj: {client.access.request_message}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
              {status !== "approved" && status !== "blocked" && (
                <AdminButton
                  size="sm"
                  disabled={disabled}
                  onClick={() => onAction("approve")}
                >
                  Acceptă
                </AdminButton>
              )}
              {status === "pending" && (
                <AdminButton
                  size="sm"
                  variant="secondary"
                  disabled={disabled}
                  onClick={() => onAction("reject", `Respingi solicitarea lui ${name}?`)}
                >
                  Respinge
                </AdminButton>
              )}
              {status === "approved" && (
                <AdminButton
                  size="sm"
                  variant="secondary"
                  disabled={disabled}
                  onClick={() => onAction("revoke", `Revoci accesul lui ${name}?`)}
                >
                  Revocă accesul
                </AdminButton>
              )}
              {status === "blocked" ? (
                <AdminButton
                  size="sm"
                  variant="secondary"
                  disabled={disabled}
                  onClick={() => onAction("unblock", `Deblochezi clientul ${name}?`)}
                >
                  Deblochează
                </AdminButton>
              ) : (
                <AdminButton
                  size="sm"
                  variant="danger"
                  disabled={disabled}
                  onClick={() => onAction("block", `Blochezi clientul ${name}?`)}
                >
                  Blochează
                </AdminButton>
              )}
              {status === "rejected" && (
                <AdminButton
                  size="sm"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => onAction("reopen", `Redeschizi solicitarea lui ${name}?`)}
                >
                  Redeschide solicitarea
                </AdminButton>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminCard>
  );
}
