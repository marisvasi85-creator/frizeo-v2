"use client";

import { useCallback, useEffect, useState } from "react";

export function useSavedFeedback(durationMs = 2500) {
  const [saved, setSaved] = useState(false);

  const markSaved = useCallback(() => {
    setSaved(true);
  }, []);

  const clearSaved = useCallback(() => {
    setSaved(false);
  }, []);

  useEffect(() => {
    if (!saved) return;

    const timer = setTimeout(() => setSaved(false), durationMs);
    return () => clearTimeout(timer);
  }, [saved, durationMs]);

  return { saved, markSaved, clearSaved };
}
