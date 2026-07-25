"use client";

import { useEffect } from "react";
import {
  markSetupChecklistStep,
  type SetupChecklistStep,
} from "@/lib/setup-checklist/storage";

type Props = {
  barberId: string;
  step: SetupChecklistStep;
};

/** Marks a setup-checklist step complete when the target page is opened. */
export default function SetupChecklistStepMarker({ barberId, step }: Props) {
  useEffect(() => {
    markSetupChecklistStep(barberId, step);
  }, [barberId, step]);

  return null;
}
