"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AdminButton from "@/app/admin/components/AdminButton";

type DestinationOption = {
  id: string;
  destinationType: "facebook_page" | "instagram_business";
  displayName: string | null;
};

type HistoryJob = {
  id: string;
  assetId: string;
  destinationType: string;
  displayName: string | null;
  status: string;
  executionMode: string;
  safeError: string | null;
  caption: string | null;
};

const ERRORS: Record<string, string> = {
  not_configured: "Publicarea Meta nu este disponibilă.",
  origin: "Cererea nu vine din staging.frizeo.ro.",
  forbidden: "Doar owner sau manager pot publica.",
  capability_off: "Integrarea Meta este oprită pentru acest salon.",
  live_off: "Publicarea reală este oprită.",
  invalid_image: "Imaginea trebuie să fie JPEG, PNG sau WEBP, cu raport între 4:5 și 1.91:1 și lățime de cel puțin 320 px.",
  unsupported_type: "Formatul imaginii nu este acceptat. Folosește JPEG, PNG sau WEBP.",
  caption_too_long: "Textul poate avea cel mult 2200 de caractere.",
  too_many_hashtags: "Textul poate avea cel mult 30 de hashtag-uri.",
  too_many_mentions: "Textul poate avea cel mult 20 de mențiuni.",
  invalid: "Datele trimise nu sunt valide.",
  destination_mismatch: "Destinația nu aparține acestui salon.",
  idempotency_conflict: "Aceeași acțiune a fost trimisă cu date diferite.",
  needs_reconnect: "Conexiunea Meta trebuie refăcută manual.",
  save_failed: "Publicarea nu a putut fi salvată.",
  upload_failed: "Imaginea nu a putut fi salvată.",
  not_eligible: "Imaginea nu poate fi ștearsă cât timp publicarea este în curs sau are rezultat necunoscut.",
  cleanup_failed: "Imaginea nu a putut fi ștearsă.",
  not_found: "Publicarea nu a fost găsită.",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Schiță mock",
  pending: "În așteptare",
  publishing: "În curs",
  published: "Publicat",
  failed: "Eșuat",
  cancelled: "Anulat",
  unknown: "Rezultat necunoscut",
};

function labelFor(type: string, name: string | null): string {
  const channel = type === "instagram_business" ? "Instagram" : "Facebook";
  return name ? `${channel} · ${name}` : channel;
}

export default function PublishComposer({
  liveAvailable,
  destinations,
  history,
}: {
  liveAvailable: boolean;
  destinations: DestinationOption[];
  history: HistoryJob[];
}) {
  const router = useRouter();
  const keyRef = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [selected, setSelected] = useState<string[]>(destinations.map((item) => item.id));
  const [message, setMessage] = useState<string | null>(null);
  const [jobs, setJobs] = useState<HistoryJob[]>(history);
  const historyKey = history.map((job) => job.id).join(",");
  useEffect(() => {
    setJobs(history);
  }, [historyKey, history]);
  const previewRef = useRef<string | null>(null);
  previewRef.current = previewUrl;
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);
  const [busy, setBusy] = useState(false);
  const [mediaPath, setMediaPath] = useState<string | null>(null);

  const previewName = useMemo(() => file?.name ?? "", [file]);

  function chooseFile(next: File | null) {
    setFile(next);
    setMediaPath(null);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return next ? URL.createObjectURL(next) : null;
    });
  }

  function toggle(id: string) {
    setSelected((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  }

  async function upload(): Promise<string | null> {
    if (mediaPath) return mediaPath;
    if (!file) {
      setMessage("Alege o imagine.");
      return null;
    }
    const body = new FormData();
    body.set("image", file);
    const response = await fetch("/api/integrations/meta/publish/media", {
      method: "POST",
      body,
    });
    const payload = await response.json().catch(() => null) as { mediaObjectPath?: string; error?: string } | null;
    if (!response.ok || !payload?.mediaObjectPath) {
      setMessage(ERRORS[payload?.error ?? ""] ?? "Imaginea nu a putut fi încărcată.");
      return null;
    }
    setMediaPath(payload.mediaObjectPath);
    return payload.mediaObjectPath;
  }

  async function runLive() {
    if (!liveAvailable || busy) return;
    if (!keyRef.current) keyRef.current = crypto.randomUUID();
    const idempotencyKey = keyRef.current;
    setBusy(true);
    setMessage(null);
    try {
      const path = await upload();
      if (!path) return;
      const response = await fetch("/api/integrations/meta/publish/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey,
          caption,
          destinationIds: selected,
          mediaObjectPath: path,
        }),
      });
      const payload = await response.json().catch(() => null) as {
        error?: string;
        jobs?: HistoryJob[];
      } | null;
      if (!response.ok || !payload?.jobs) {
        setMessage(ERRORS[payload?.error ?? ""] ?? "Publicarea nu a putut fi pornită.");
        return;
      }
      setJobs((current) => [...payload.jobs!, ...current]);
      setMessage("Cererea a fost înregistrată. Statusul fiecărei destinații este mai jos.");
      keyRef.current = null;
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function runMock() {
    if (busy) return;
    if (!keyRef.current) keyRef.current = crypto.randomUUID();
    const idempotencyKey = keyRef.current;
    setBusy(true);
    setMessage(null);
    try {
      const path = await upload();
      if (!path) return;
      const response = await fetch("/api/integrations/meta/publish/mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey,
          caption,
          destinationIds: selected,
          mediaObjectPath: path,
        }),
      });
      const payload = await response.json().catch(() => null) as {
        error?: string;
        externalCall?: boolean;
        jobs?: HistoryJob[];
      } | null;
      if (!response.ok || !payload?.jobs) {
        setMessage(ERRORS[payload?.error ?? ""] ?? "Testul mock nu a putut fi salvat.");
        return;
      }
      if (payload.externalCall) {
        setMessage("Testul a fost oprit: nu trebuia să existe un apel extern.");
        return;
      }
      setJobs((current) => [...payload.jobs!, ...current]);
      setMessage("Testul mock a fost salvat local. Nu s-a trimis nimic către Facebook sau Instagram.");
      keyRef.current = null;
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function cleanup(assetId: string) {
    const response = await fetch("/api/integrations/meta/publish/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId }),
    });
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) {
      setMessage(ERRORS[payload?.error ?? ""] ?? "Imaginea nu a putut fi ștearsă.");
      return;
    }
    setMessage("Imaginea a fost ștearsă din spațiul de stocare.");
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <label className="grid gap-2 text-sm text-frz-ink">
        Imagine
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
        />
      </label>
      {previewUrl && (
        <img src={previewUrl} alt={previewName || "Previzualizare"} className="max-h-80 rounded-xl border border-frz-line object-contain" />
      )}
      <label className="grid gap-2 text-sm text-frz-ink">
        Text
        <textarea
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          maxLength={2200}
          rows={5}
          className="rounded-xl border border-frz-line bg-frz-card p-3"
        />
      </label>
      <fieldset className="grid gap-2">
        <legend className="text-sm text-frz-ink">Destinații</legend>
        {destinations.map((destination) => (
          <label key={destination.id} className="flex items-center gap-2 text-sm text-frz-ink">
            <input
              type="checkbox"
              checked={selected.includes(destination.id)}
              onChange={() => toggle(destination.id)}
            />
            {labelFor(destination.destinationType, destination.displayName)}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <AdminButton
          type="button"
          disabled={!liveAvailable || busy || selected.length === 0}
          onClick={liveAvailable ? runLive : undefined}
        >
          Publică
        </AdminButton>
        <AdminButton type="button" variant="secondary" disabled={busy || selected.length === 0} onClick={runMock}>
          Rulează testul mock
        </AdminButton>
      </div>
      <p className="text-sm text-frz-muted">
        {liveAvailable
          ? "Publicarea reală este pornită pentru acest salon. Butonul Publică trimite imaginea către destinațiile bifate."
          : "Publicarea reală este oprită. Butonul Publică este dezactivat și nu trimite conținut către Facebook sau Instagram."}
      </p>
      <p className="text-sm text-frz-muted">
        Testul mock salvează o schiță locală pentru destinațiile alese. Nu se face niciun apel către Meta.
      </p>
      {message && <p className="text-sm text-frz-ink">{message}</p>}
      <div className="grid gap-3">
        <h2 className="text-lg font-semibold text-frz-ink">Istoric</h2>
        {jobs.length === 0 && <p className="text-sm text-frz-muted">Nu există publicări salvate.</p>}
        {jobs.map((job) => {
          const terminal = job.status === "draft" || job.status === "published" || job.status === "failed" || job.status === "cancelled";
          return (
            <div key={job.id} className="rounded-xl border border-frz-line p-3">
              <p className="text-sm font-medium text-frz-ink">
                {labelFor(job.destinationType, job.displayName)} · {STATUS_LABEL[job.status] ?? job.status}
              </p>
              {job.caption && <p className="mt-1 text-sm text-frz-muted">{job.caption}</p>}
              {job.safeError && (
                <p className="mt-1 text-sm text-frz-ink">{ERRORS[job.safeError] ?? "Publicarea nu a putut fi confirmată."}</p>
              )}
              {terminal && job.assetId && (
                <div className="mt-2">
                  <AdminButton type="button" variant="ghost" onClick={() => cleanup(job.assetId)}>
                    Șterge imaginea
                  </AdminButton>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
