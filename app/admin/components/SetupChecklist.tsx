"use client";

import { useCallback, useSyncExternalStore } from "react";
import AdminButton from "./AdminButton";
import {
  dismissSetupChecklist,
  getSetupChecklistServerSnapshot,
  getSetupChecklistSnapshot,
  isSetupChecklistComplete,
  SETUP_CHECKLIST_STEPS,
  subscribeSetupChecklist,
} from "@/lib/setup-checklist/storage";

type Props = {
  barberId: string;
  /** Server-side gate: hide for accounts that already take bookings. */
  eligible: boolean;
};

const subscribeNoop = () => () => {};

export default function SetupChecklist({ barberId, eligible }: Props) {
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  const getSnapshot = useCallback(
    () => getSetupChecklistSnapshot(barberId),
    [barberId],
  );

  const state = useSyncExternalStore(
    subscribeSetupChecklist,
    getSnapshot,
    getSetupChecklistServerSnapshot,
  );

  if (!mounted || !eligible) return null;
  if (state.dismissed || isSetupChecklistComplete(state)) return null;

  const completedCount = SETUP_CHECKLIST_STEPS.filter(
    (step) => state.completed[step.id],
  ).length;

  return (
    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-emerald-100">
            Primii pași
          </h2>
          <p className="text-sm text-white/65 mt-1">
            Contul e gata de rezervări. Personalizează serviciile, programul și
            notificările — durează câteva minute.
          </p>
          <p className="text-xs text-white/45 mt-2">
            {completedCount}/{SETUP_CHECKLIST_STEPS.length} completate
          </p>
        </div>

        <button
          type="button"
          onClick={() => dismissSetupChecklist(barberId)}
          className="shrink-0 text-sm text-white/50 hover:text-white transition"
          aria-label="Închide checklist-ul de setup"
        >
          Închide
        </button>
      </div>

      <ul className="mt-5 space-y-3">
        {SETUP_CHECKLIST_STEPS.map((step) => {
          const done = Boolean(state.completed[step.id]);

          return (
            <li
              key={step.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg bg-black/20 border border-white/5 px-4 py-3"
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <span
                  className={
                    done
                      ? "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-black text-xs font-bold"
                      : "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/25 text-white/40 text-xs"
                  }
                  aria-hidden
                >
                  {done ? "✓" : ""}
                </span>
                <div className="min-w-0">
                  <p
                    className={
                      done
                        ? "font-medium text-white/50 line-through"
                        : "font-medium text-white"
                    }
                  >
                    {step.title}
                  </p>
                  <p className="text-sm text-white/55 mt-0.5">
                    {step.description}
                  </p>
                </div>
              </div>

              {!done && (
                <AdminButton
                  size="sm"
                  variant="secondary"
                  href={step.href}
                  className="sm:shrink-0"
                >
                  {step.cta}
                </AdminButton>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
