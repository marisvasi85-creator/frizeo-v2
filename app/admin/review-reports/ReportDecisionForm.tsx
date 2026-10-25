"use client";

import { useActionState } from "react";
import type { ModerationResult } from "@/lib/reviews/moderation";
import { hideReportedReview, reactivateReportedReview } from "./actions";

export default function ReportDecisionForm({
  reportId,
  status,
}: {
  reportId: string;
  status: "open" | "hidden";
}) {
  const action = status === "open" ? hideReportedReview : reactivateReportedReview;
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="reportId" value={reportId} />
      <button
        type="submit"
        disabled={pending}
        className={
          status === "open"
            ? "rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-60"
            : "rounded-xl bg-frz-ink px-4 py-2 text-sm font-medium text-frz-ink-contrast disabled:opacity-60"
        }
      >
        {pending
          ? "Se salvează..."
          : status === "open"
            ? "Ascunde recenzia"
            : "Reactivează recenzia"}
      </button>
      {state && !state.ok ? (
        <p className="text-xs text-red-700">{state.message}</p>
      ) : null}
    </form>
  );
}
