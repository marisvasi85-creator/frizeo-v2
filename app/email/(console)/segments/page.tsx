import SegmentsClient from "./SegmentsClient";
import { listMarketingSegments } from "@/lib/frizeo-email/segments";

export default async function SegmentsPage() {
  let segments: Awaited<ReturnType<typeof listMarketingSegments>> = [];
  let error: string | null = null;
  try {
    segments = await listMarketingSegments();
  } catch (loadError) {
    error =
      loadError instanceof Error
        ? loadError.message
        : "Nu am putut încărca segmentele dinamice.";
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      )}
      <SegmentsClient initialSegments={segments} />
    </div>
  );
}
