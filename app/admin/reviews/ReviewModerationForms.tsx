"use client";

import { useActionState } from "react";
import { AdminTextarea } from "@/app/admin/components/AdminInput";
import type { ModerationResult } from "@/lib/reviews/moderation";
import { reportReview, saveReviewReply } from "./actions";

function Feedback({ state }: { state: ModerationResult | null }) {
  if (!state) return null;
  return (
    <p className={state.ok ? "text-xs text-emerald-700" : "text-xs text-red-700"}>
      {state.ok ? "Salvat." : state.message}
    </p>
  );
}

export default function ReviewModerationForms({
  reviewId,
  reply,
  reportStatus,
}: {
  reviewId: string;
  reply: string | null;
  reportStatus: "open" | "hidden" | "reactivated" | null;
}) {
  const [replyState, replyAction, replyPending] = useActionState(
    saveReviewReply,
    null,
  );
  const [reportState, reportAction, reportPending] = useActionState(
    reportReview,
    null,
  );
  const reported = reportStatus === "open" || reportStatus === "hidden";

  return (
    <div className="mt-4 space-y-4 border-t border-frz-line/70 pt-4">
      <form action={replyAction} className="space-y-2">
        <input type="hidden" name="reviewId" value={reviewId} />
        <label className="block text-sm font-medium text-frz-ink" htmlFor={`reply-${reviewId}`}>
          Răspunsul salonului
        </label>
        <p className="text-xs text-frz-muted">
          Apare public sub recenzia clientului. Nu schimbă ratingul.
        </p>
        <AdminTextarea
          id={`reply-${reviewId}`}
          name="reply"
          rows={3}
          maxLength={1000}
          defaultValue={reply ?? ""}
        />
        <button
          type="submit"
          disabled={replyPending}
          className="rounded-xl bg-frz-ink px-4 py-2 text-sm font-medium text-frz-ink-contrast disabled:opacity-60"
        >
          {replyPending ? "Se salvează..." : "Salvează răspunsul"}
        </button>
        <Feedback state={replyState} />
      </form>

      {reported ? (
        <p className="text-xs text-amber-800">
          {reportStatus === "hidden"
            ? "Recenzia a fost ascunsă după raportare și rămâne salvată."
            : "Raportarea este în analiză. Recenzia rămâne publică până la o decizie."}
        </p>
      ) : (
        <form action={reportAction} className="space-y-2">
          <input type="hidden" name="reviewId" value={reviewId} />
          <label className="block text-sm font-medium text-frz-ink" htmlFor={`reason-${reviewId}`}>
            Raportează un abuz
          </label>
          <p className="text-xs text-frz-muted">
            O notă mică nu ascunde recenzia. Descrie doar dacă textul este abuziv.
          </p>
          <AdminTextarea
            id={`reason-${reviewId}`}
            name="reason"
            rows={2}
            maxLength={500}
            required
            minLength={10}
            placeholder="De exemplu: insultă, date personale sau spam."
          />
          <button
            type="submit"
            disabled={reportPending}
            className="rounded-xl border border-frz-line px-4 py-2 text-sm font-medium text-frz-ink disabled:opacity-60"
          >
            {reportPending ? "Se trimite..." : "Raportează recenzia"}
          </button>
          <Feedback state={reportState} />
        </form>
      )}
    </div>
  );
}
