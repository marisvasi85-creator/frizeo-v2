import LegalPageLayout from "@/app/components/LegalPageLayout";
import DpaText from "@/app/dpa/DpaText";
import { dpaDocumentHash } from "@/lib/dpa/document";
import { dpaVersionRecord } from "@/lib/dpa/versions";
import { createPageMetadata } from "@/lib/site/pageMetadata";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return [{ version: "dpa-2026-11-15" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ version: string }>;
}) {
  const { version } = await params;
  const record = dpaVersionRecord(version);
  if (!record) return {};
  return createPageMetadata({
    title: `Acord de prelucrare ${record.version}`,
    description: `Textul versiunii ${record.version} a acordului de prelucrare Frizeo.`,
    path: `/dpa/v/${record.version}`,
  });
}

export default async function DpaVersionPage({
  params,
}: {
  params: Promise<{ version: string }>;
}) {
  const { version } = await params;
  const record = dpaVersionRecord(version);
  if (!record) notFound();
  const hash = dpaDocumentHash(record.text);

  return (
    <LegalPageLayout title="Acord de prelucrare" path={`/dpa/v/${record.version}`}>
      <p className="text-sm text-gray-500 mb-8 break-all">
        Versiune: {record.version}
        <br />
        Data: {record.date}
        <br />
        SHA-256: {hash}
      </p>
      <DpaText text={record.text} />
    </LegalPageLayout>
  );
}
