import Link from "next/link";
import { redirect } from "next/navigation";
import AdminPageHeader from "../components/AdminPageHeader";
import DpaAcceptanceForm from "./DpaAcceptanceForm";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import { dpaAcceptanceEnabled } from "@/lib/dpa/acceptance";
import { DPA_DRAFT_VERSION, dpaDocumentHash } from "@/lib/dpa/document";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminDpaPage() {
  const session = await getAdminSession();
  if (!session?.user) redirect("/login");

  const enabled = dpaAcceptanceEnabled(process.env);
  const hash = dpaDocumentHash();
  const isOwner = session.role === "owner" && Boolean(session.tenantId);
  let acceptedAt: string | null = null;
  if (enabled && isOwner && session.tenantId) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("salon_dpa_acceptances")
      .select("accepted_at")
      .eq("tenant_id", session.tenantId)
      .eq("document_version", DPA_DRAFT_VERSION)
      .maybeSingle();
    acceptedAt = data?.accepted_at ?? null;
  }

  const when = acceptedAt
    ? new Intl.DateTimeFormat("ro-RO", {
        timeZone: "Europe/Bucharest",
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(acceptedAt))
    : null;

  return (
    <div className="space-y-6 max-w-2xl">
      <AdminPageHeader
        title="Acord de prelucrare"
        subtitle="Proiect pentru salon. Nu este obligatoriu și nu blochează programările."
      />
      <p className="text-sm text-frz-muted">
        Versiune: {DPA_DRAFT_VERSION}
        <br />
        SHA-256: {hash}
      </p>
      <p className="text-sm">
        Textul public este la <Link href="/dpa">/dpa</Link>.
      </p>
      {!isOwner ? (
        <p>Doar proprietarul salonului poate înregistra acceptarea.</p>
      ) : null}
      {isOwner && !enabled ? (
        <p>
          Înregistrarea este oprită. Contul rămâne deschis, iar utilizatorii
          existenți nu sunt marcați ca au acceptat.
        </p>
      ) : null}
      {isOwner && enabled && when ? (
        <p>
          Această versiune are o înregistrare la {when} (Europe/Bucharest).
          Proiectul rămâne nesemnat. Caseta nu este bifată dinainte.
        </p>
      ) : null}
      {isOwner && enabled && !when ? <DpaAcceptanceForm version={DPA_DRAFT_VERSION} hash={hash} /> : null}
    </div>
  );
}
