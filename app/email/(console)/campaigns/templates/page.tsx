import TemplatesClient from "./TemplatesClient";
import { listEmailTemplates } from "@/lib/frizeo-email/templates";

export default async function TemplatesPage() {
  let templates: Awaited<ReturnType<typeof listEmailTemplates>> = [];
  let error: string | null = null;
  try {
    templates = await listEmailTemplates();
  } catch (loadError) {
    error =
      loadError instanceof Error
        ? loadError.message
        : "Nu am putut încărca template-urile.";
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      )}
      <TemplatesClient initialTemplates={templates} />
    </div>
  );
}
