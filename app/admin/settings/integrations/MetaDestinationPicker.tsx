"use client";

import { useState } from "react";
import AdminButton from "@/app/admin/components/AdminButton";

type InstagramAccount = { id: string; username: string | null };
type FacebookPage = {
  id: string;
  name: string;
  tasks: string[];
  instagram: InstagramAccount | null;
};

const ERRORS: Record<string, string> = {
  timeout: "Meta nu a răspuns la timp.",
  graph_error: "Meta nu a putut lista paginile.",
  invalid_paging: "Răspunsul Meta conține o paginare nevalidă. Paginile nu au fost folosite.",
  page_limit: "Sunt prea multe pagini pentru o singură conectare.",
  needs_reconnect: "Conexiunea trebuie refăcută înainte de a lista paginile.",
  missing: "Nu există o autorizare Meta salvată.",
  empty: "Alege cel puțin o pagină.",
  unknown_destination: "Selecția nu mai corespunde paginilor autorizate.",
  instagram_without_page: "Contul Instagram poate fi salvat doar împreună cu pagina Facebook.",
  forbidden: "Nu ai dreptul să administrezi integrarea.",
  capability_off: "Integrarea Meta este oprită pentru acest salon.",
  unconfigured: "Meta nu este configurat pe server.",
  save_failed: "Destinațiile nu au putut fi salvate.",
};

export default function MetaDestinationPicker() {
  const [pages, setPages] = useState<FacebookPage[] | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function loadPages() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/integrations/meta/destinations", { method: "POST" });
      const body = (await response.json()) as { pages?: FacebookPage[]; error?: string };
      if (!response.ok) {
        setPages(null);
        setMessage(ERRORS[body.error ?? ""] ?? "Paginile nu au putut fi încărcate.");
        return;
      }
      setPages(body.pages ?? []);
      setSelected({});
      if ((body.pages ?? []).length === 0) {
        setMessage("Nu există pagini Facebook disponibile pentru acest cont.");
      }
    } catch {
      setMessage("Meta nu a răspuns.");
    } finally {
      setPending(false);
    }
  }

  function toggle(key: string, checked: boolean, pageId?: string) {
    setSelected((current) => {
      const next = { ...current, [key]: checked };
      if (key.startsWith("instagram_business:") && checked && pageId) {
        next[`facebook_page:${pageId}`] = true;
      }
      if (key.startsWith("facebook_page:") && !checked) {
        const page = pages?.find((item) => `facebook_page:${item.id}` === key);
        if (page?.instagram) next[`instagram_business:${page.instagram.id}`] = false;
      }
      return next;
    });
  }

  async function save() {
    const destinations = Object.entries(selected)
      .filter(([, checked]) => checked)
      .map(([key]) => {
        const [type, id] = key.split(":");
        return { type, id };
      });
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/integrations/meta/destinations/select", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ destinations }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(ERRORS[body.error ?? ""] ?? "Destinațiile nu au putut fi salvate.");
        return;
      }
      window.location.assign("/admin/settings/integrations?meta=saved");
    } catch {
      setMessage("Meta nu a răspuns.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <AdminButton type="button" variant="secondary" onClick={loadPages} disabled={pending}>
        Încarcă paginile
      </AdminButton>
      {message && <p className="text-sm text-frz-muted">{message}</p>}
      {pages && pages.length > 0 && (
        <div className="space-y-3">
          {pages.map((page) => (
            <fieldset key={page.id} className="rounded-xl border border-frz-line p-3">
              <label className="flex items-start gap-2 text-sm text-frz-ink">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={Boolean(selected[`facebook_page:${page.id}`])}
                  onChange={(event) => toggle(`facebook_page:${page.id}`, event.target.checked)}
                />
                <span>
                  <span className="font-medium">{page.name}</span>
                  <span className="mt-1 block text-frz-muted">Pagină Facebook · {page.id}</span>
                  {page.tasks.length > 0 && (
                    <span className="mt-1 block text-frz-muted">{page.tasks.join(", ")}</span>
                  )}
                </span>
              </label>
              {page.instagram ? (
                <label className="mt-3 flex items-start gap-2 text-sm text-frz-ink">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={Boolean(selected[`instagram_business:${page.instagram.id}`])}
                    onChange={(event) =>
                      toggle(
                        `instagram_business:${page.instagram?.id}`,
                        event.target.checked,
                        page.id,
                      )
                    }
                  />
                  <span>
                    <span className="font-medium">
                      {page.instagram.username ? `@${page.instagram.username}` : "Instagram profesional"}
                    </span>
                    <span className="mt-1 block text-frz-muted">
                      Cont Instagram legat de această pagină · {page.instagram.id}
                    </span>
                  </span>
                </label>
              ) : (
                <p className="mt-3 text-sm text-frz-muted">Această pagină nu are un cont Instagram profesional.</p>
              )}
            </fieldset>
          ))}
          <AdminButton type="button" onClick={save} disabled={pending}>
            Salvează destinațiile
          </AdminButton>
        </div>
      )}
    </div>
  );
}
