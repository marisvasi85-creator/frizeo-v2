import AdminButton from "./AdminButton";
import type { NextBestAction } from "@/lib/frizeo-email/lifecycle";
import { NEXT_BEST_ACTION_COPY } from "@/lib/frizeo-email/lifecycle";

export default function NextBestActionCard({
  action,
  stageLabel,
}: {
  action: NextBestAction | null;
  stageLabel?: string;
}) {
  if (!action || action === "none") return null;
  const copy = NEXT_BEST_ACTION_COPY[action];
  if (!copy?.title) return null;

  return (
    <div className="rounded-xl border border-frz-line bg-frz-card p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-frz-ink/45">
        Următorul pas
        {stageLabel ? ` · ${stageLabel}` : ""}
      </p>
      <h2 className="mt-2 text-lg font-semibold">{copy.title}</h2>
      <p className="mt-1 text-sm text-frz-ink/65">{copy.body}</p>
      <div className="mt-4">
        <AdminButton href={copy.href}>{copy.cta}</AdminButton>
      </div>
    </div>
  );
}
