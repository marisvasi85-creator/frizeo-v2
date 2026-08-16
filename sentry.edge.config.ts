import * as Sentry from "@sentry/nextjs";
import { getSharedSentryOptions } from "@/lib/sentry/shared";

Sentry.init({
  ...getSharedSentryOptions(),
  // Edge tracing kept minimal — same conservative sample rate as shared options.
});
