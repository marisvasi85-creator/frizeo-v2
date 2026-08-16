import * as Sentry from "@sentry/nextjs";
import { getSharedSentryOptions } from "@/lib/sentry/shared";

Sentry.init({
  ...getSharedSentryOptions(),
  // Session Replay off — Free plan / privacy (not enabled aggressively).
  // Logs / Seer / paid AI features are not enabled.
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
