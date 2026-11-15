import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AdminPageHeader from "../components/AdminPageHeader";
import DpaAcceptanceForm from "./DpaAcceptanceForm";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import { hostnameFromHeaderStore, isStaging } from "@/lib/app/environment";
import { dpaAcceptanceEnabledForTenant } from "@/lib/dpa/access";
import { DPA_VERSION, dpaDocumentHash } from "@/lib/dpa/document";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminDpaPage() {
  const session = await getAdminSession();
  if (!session?.user) redirect("/login");

  const enabled = dpaAcceptanceEnabledForTenant({
    tenantId: session.tenantId,
    hostname: hostnameFromHeaderStore(await headers()),
    stagingRuntime: isStaging(),
  });
  const hash = dpaDocumentHash();
  const isOwner = session.role === "owner" && Boolean(session.tenantId);
  let proof: {
    accepted_at: string;
    salon_legal_name: string | null;
    representative_name: string | null;
  } | null = null;
  if (enabled && isOwner && session.tenantId) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("salon_dpa_acceptances")
      .select("accepted_at, salon_legal_name, representative_name")
      .eq("tenant_id", session.tenantId)
      .eq("document_version", DPA_VERSION)
      .maybeSingle();
    proof = data;
  }

  const when = proof
    ? new Intl.DateTimeFormat("ro-RO", {
        timeZone: "Europe/Bucharest",
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(proof.accepted_at))
    : null;

  return (
    <div className="space-y-6 max-w-2xl">
      <AdminPageHeader
        title="Acord date"
        subtitle="Acordul pentru datele prelucrate în numele salonului. Nu oprește programările."
      />
      <p className="text-sm text-frz-muted break-all">
        Versiune: {DPA_VERSION}
        <br />
        SHA-256: {hash}
      </p>
      <p className="text-sm">
        Citește acordul la <Link href="/dpa">/dpa</Link>
        {" "}și la <Link href={`/dpa/v/${DPA_VERSION}`}>/dpa/v/{DPA_VERSION}</Link>.
      </p>
      {session.tenantName ? (
        <p className="text-sm">Salonul din cont: {session.tenantName}</p>
      ) : null}
      {!isOwner ? (
        <p>Doar proprietarul salonului poate accepta acordul.</p>
      ) : null}
      {isOwner && !enabled ? (
        <p>
          Acceptarea electronică nu este activă pentru acest salon. Poți citi
          acordul. Programările rămân disponibile.
        </p>
      ) : null}
      {isOwner && enabled && when ? (
        <div className="space-y-2 text-sm">
          <p>Acceptarea acestei versiuni este înregistrată la {when} (Europe/Bucharest).</p>
          <p>Salon: {proof?.salon_legal_name}</p>
          <p>Reprezentant: {proof?.representative_name}</p>
          <p>
            Textul acceptat: <Link href={`/dpa/v/${DPA_VERSION}`}>/dpa/v/{DPA_VERSION}</Link>
          </p>
        </div>
      ) : null}
      {isOwner && enabled && !when ? (
        <DpaAcceptanceForm version={DPA_VERSION} hash={hash} />
      ) : null}
    </div>
  );
}
